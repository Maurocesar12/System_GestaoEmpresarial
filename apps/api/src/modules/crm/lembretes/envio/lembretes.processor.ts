import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ROTULO_CANAL_LEMBRETE } from '@gestao/shared-types';
import { ErroDeNotificacao, Notificador } from '../../../../infra/notificacoes/notificador';
import { PrismaService } from '../../../../infra/prisma/prisma.service';
import { FILA_LEMBRETES, type PayloadEnvioLembrete } from './envio.constantes';
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

    // Reconferido aqui, e não só na varredura: entre uma coisa e outra alguém
    // pode ter cancelado o lembrete pela tela. É esta checagem que garante que
    // um job repetido ou atrasado não reenvie o que já saiu.
    if (lembrete.status !== 'pendente') {
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

    const mensagem = montarMensagemLembrete({
      clienteNome: lembrete.cliente.nome,
      clienteEmail: lembrete.cliente.email,
      empresaNome: lembrete.tenant.nome,
    });

    try {
      await this.notificador.enviar(mensagem);
    } catch (erro) {
      await this.tratarFalhaDeEnvio(tenantId, lembreteId, erro);

      return;
    }

    // Gravado logo após o envio para encurtar ao máximo a janela em que a
    // mensagem já saiu mas o banco ainda não sabe. Se o processo morrer
    // exatamente aqui, o lembrete continua pendente e será enviado de novo —
    // duplicar um lembrete é ruim, mas é menos grave do que dar como enviado
    // algo que nunca saiu.
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
   * lembrete como `falhou`. Falha temporária mantém o lembrete `pendente`, com
   * o motivo registrado, e o erro sobe para o BullMQ tentar de novo.
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

  private async registrarDesfecho(
    tenantId: string,
    lembreteId: string,
    dados: { status: 'pendente' | 'enviado' | 'falhou'; enviadoEm?: Date; erro: string | null },
  ): Promise<void> {
    await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.lembreteFollowUp.update({ where: { id: lembreteId }, data: dados }),
    );
  }
}
