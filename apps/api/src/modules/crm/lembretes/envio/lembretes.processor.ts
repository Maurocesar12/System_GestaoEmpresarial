import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ROTULO_CANAL_LEMBRETE } from '@gestao/shared-types';
import { nenhumaLinhaCasou } from '../../../../common/concorrencia';
import { ErroDeNotificacao, Notificador } from '../../../../infra/notificacoes/notificador';
import { PrismaService } from '../../../../infra/prisma/prisma.service';
import {
  FILA_LEMBRETES,
  TEMPO_MAXIMO_ENVIANDO_MS,
  type PayloadEnvioLembrete,
} from './envio.constantes';
import { montarMensagemLembrete } from './mensagem-lembrete';

/**
 * Envia um lembrete e registra o desfecho.
 *
 * O ponto mais importante deste arquivo é o contexto de empresa. O worker roda
 * fora de qualquer requisição HTTP, então não existe tenant no
 * `AsyncLocalStorage` — quem o fornece é o `tenantId` que veio no job, aplicado
 * via `comTenantExplicito` em **toda** ida ao banco (arquitetura §4.3). Antes
 * disso, o worker não lê nem grava nada.
 */
@Processor(FILA_LEMBRETES)
export class LembretesProcessor extends WorkerHost {
  private readonly logger = new Logger(LembretesProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificador: Notificador,
  ) {
    super();
  }

  async process(job: Job<PayloadEnvioLembrete>): Promise<void> {
    const { lembreteId, tenantId } = job.data;

    // Job malformado falha alto em vez de rodar sem escopo. Sem tenant não há
    // isolamento, e é exatamente esse o caminho por onde dado de uma empresa
    // vazaria para outra.
    if (!lembreteId || !tenantId) {
      throw new Error(`Job ${job.id ?? '?'} sem lembreteId ou tenantId — envio abortado.`);
    }

    const lembrete = await this.carregar(tenantId, lembreteId);

    // Some entre a varredura e o processamento se o cliente for excluído
    // (a exclusão do cliente leva os lembretes junto, por cascade).
    if (!lembrete) {
      this.logger.warn(`Lembrete ${lembreteId} não existe mais — nada a enviar.`);
      return;
    }

    // Reivindica antes de enviar: `pendente -> enviando` num único UPDATE
    // condicional. Ler o status e enviar em seguida deixava uma janela em que
    // alguém cancelava pela tela e o e-mail saía assim mesmo; e dois jobs do
    // mesmo lembrete (retry, varredura repetida) passavam juntos pela leitura.
    // Quem perde a reivindicação não envia nada. Depois dela, o cancelamento
    // deixa de valer (só cancela `pendente`), então "enviado" é sempre verdade.
    const reivindicado = await this.reivindicar(tenantId, lembreteId);

    if (!reivindicado) {
      this.logger.log(`Lembrete ${lembreteId} já está "${lembrete.status}" — envio ignorado.`);
      return;
    }

    if (lembrete.canal !== 'email') {
      // WhatsApp utility depende de conta aprovada na Meta e ainda não existe.
      // Marcar como falha é melhor do que deixar pendente para sempre: aparece
      // na tela, com o motivo, em vez de sumir silenciosamente.
      await this.registrarDesfecho(tenantId, lembreteId, {
        status: 'falhou',
        erro: `Canal ${ROTULO_CANAL_LEMBRETE[lembrete.canal]} ainda não está disponível para envio automático.`,
      });

      return;
    }

    try {
      // Dentro do `try`: depois da reivindicação, qualquer falha precisa devolver
      // o lembrete a um estado resolvido, senão ele ficaria `enviando`.
      const mensagem = montarMensagemLembrete({
        clienteNome: lembrete.cliente.nome,
        clienteEmail: lembrete.cliente.email,
        empresaNome: lembrete.tenant.nome,
      });

      await this.notificador.enviar(mensagem);
    } catch (erro) {
      await this.tratarFalhaDeEnvio(tenantId, lembreteId, erro);

      return;
    }

    // Gravado logo após o envio para encurtar ao máximo a janela em que a
    // mensagem já saiu mas o banco ainda não sabe. Se o processo morrer
    // exatamente aqui, o lembrete fica `enviando` e, passado
    // `TEMPO_MAXIMO_ENVIANDO_MS`, a varredura o reenvia — duplicar um lembrete
    // é ruim, mas é menos grave do que dar como enviado algo que nunca saiu.
    await this.registrarDesfecho(tenantId, lembreteId, {
      status: 'enviado',
      enviadoEm: new Date(),
      erro: null,
    });

    this.logger.log(`Lembrete ${lembreteId} enviado.`);
  }

  /**
   * Decide o que fazer com uma falha de envio.
   *
   * A separação vem do `ErroDeNotificacao`: falha permanente (endereço
   * inválido, cliente sem e-mail) não melhora com repetição e encerra o
   * lembrete como `falhou`. Falha temporária devolve o lembrete a `pendente`,
   * com o motivo registrado, e o erro sobe para o BullMQ tentar de novo.
   */
  private async tratarFalhaDeEnvio(
    tenantId: string,
    lembreteId: string,
    erro: unknown,
  ): Promise<void> {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    const permanente = erro instanceof ErroDeNotificacao && erro.permanente;

    await this.registrarDesfecho(tenantId, lembreteId, {
      status: permanente ? 'falhou' : 'pendente',
      erro: motivo,
    });

    if (permanente) {
      this.logger.warn(`Lembrete ${lembreteId} falhou definitivamente: ${motivo}`);

      return;
    }

    // Relança para o BullMQ contar a tentativa e reagendar com espera. Se as
    // tentativas do job acabarem, o lembrete segue pendente no banco e a
    // varredura o traz de volta mais tarde.
    this.logger.warn(`Lembrete ${lembreteId} falhou temporariamente: ${motivo}`);

    throw erro instanceof Error ? erro : new Error(motivo);
  }

  private carregar(tenantId: string, lembreteId: string) {
    return this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.lembreteFollowUp.findUnique({
        where: { id: lembreteId },
        select: {
          status: true,
          canal: true,
          cliente: { select: { nome: true, email: true } },
          tenant: { select: { nome: true } },
        },
      }),
    );
  }

  /**
   * `pendente -> enviando`, ou retoma um `enviando` que travou (o processo que o
   * reivindicou morreu e passou de `TEMPO_MAXIMO_ENVIANDO_MS`). `true` se este
   * job ficou com o lembrete.
   */
  private async reivindicar(tenantId: string, lembreteId: string): Promise<boolean> {
    const agora = new Date();
    const limite = new Date(agora.getTime() - TEMPO_MAXIMO_ENVIANDO_MS);

    const { count } = await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.lembreteFollowUp.updateMany({
        where: {
          id: lembreteId,
          OR: [
            { status: 'pendente' },
            { status: 'enviando', OR: [{ iniciadoEm: null }, { iniciadoEm: { lt: limite } }] },
          ],
        },
        data: { status: 'enviando', iniciadoEm: agora },
      }),
    );

    return count === 1;
  }

  private async registrarDesfecho(
    tenantId: string,
    lembreteId: string,
    dados: { status: 'pendente' | 'enviado' | 'falhou'; enviadoEm?: Date; erro: string | null },
  ): Promise<void> {
    try {
      // Só grava enquanto o lembrete segue `enviando`, ou seja, enquanto este
      // job é o dono dele. O cancelamento não passa mais por aqui (só cancela
      // `pendente`); o que faz o `where` não casar é o lembrete ter sido
      // excluído (cliente apagado) ou retomado por outro job depois de parecer
      // travado. Em qualquer dos dois, regravar por cima seria errado.
      await this.prisma.comTenantExplicito(tenantId, (tx) =>
        tx.lembreteFollowUp.update({
          where: { id: lembreteId, status: 'enviando' },
          data: { ...dados, iniciadoEm: null },
        }),
      );
    } catch (erro) {
      if (!nenhumaLinhaCasou(erro)) {
        throw erro;
      }

      this.logger.warn(
        `Lembrete ${lembreteId} deixou de estar "enviando" antes do desfecho (excluído ou retomado por outro envio) — desfecho "${dados.status}" não gravado.`,
      );
    }
  }
}
