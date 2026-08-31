import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../../infra/prisma/prisma.service';
import { FILA_LEMBRETES, JOB_ENVIAR_LEMBRETE, type PayloadEnvioLembrete } from './envio.constantes';

/**
 * Teto de lembretes enfileirados por passagem.
 *
 * Existe para o caso de a aplicação ficar um tempo fora do ar e voltar com um
 * acúmulo grande: sem limite, uma única varredura tentaria carregar tudo de uma
 * vez. Com limite, o atraso é drenado aos poucos, um lote por minuto, sem
 * sufocar o banco nem o servidor de e-mail. O que sobra continua pendente e
 * entra na passagem seguinte.
 */
const LIMITE_POR_VARREDURA = 500;

/**
 * Descobre lembretes vencidos e os entrega à fila.
 *
 * A divisão de trabalho aqui é proposital: **o banco é a fonte da verdade**
 * sobre o que precisa ser enviado, e o Redis é só a esteira que leva o trabalho
 * até o worker. Se o Redis for zerado, nada se perde — os lembretes continuam
 * `pendente` no banco e a próxima varredura os enfileira de novo.
 */
@Injectable()
export class LembretesAgendador {
  private readonly logger = new Logger(LembretesAgendador.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FILA_LEMBRETES) private readonly fila: Queue<PayloadEnvioLembrete>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async enfileirarVencidos(): Promise<void> {
    try {
      const vencidos = await this.buscarVencidos();

      if (vencidos.length === 0) {
        return;
      }

      await this.fila.addBulk(
        vencidos.map((lembrete) => ({
          name: JOB_ENVIAR_LEMBRETE,
          data: { lembreteId: lembrete.id, tenantId: lembrete.tenantId },
          // O id do job é o id do lembrete. É isso que impede duplicata: se a
          // varredura de daqui a um minuto reencontrar o mesmo lembrete ainda
          // pendente porque o worker não chegou nele, o BullMQ reconhece o id
          // e ignora, em vez de enfileirar um segundo envio.
          opts: { jobId: lembrete.id },
        })),
      );

      this.logger.log(`${vencidos.length} lembrete(s) vencido(s) enviados para a fila.`);
    } catch (erro) {
      // Engolir aqui é intencional: a varredura é periódica, e uma falha (Redis
      // reiniciando, banco momentaneamente fora) se resolve sozinha na próxima
      // passagem. Deixar o erro subir só encheria o log de rejeição não tratada
      // sem mudar o desfecho.
      this.logger.error(
        `Falha na varredura de lembretes: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
  }

  /**
   * Lembretes pendentes cuja hora já passou, de todas as empresas.
   *
   * Roda sem contexto de tenant — é a única consulta do sistema que precisa
   * enxergar várias empresas ao mesmo tempo. Quem permite isso é a política
   * `lembrete_varredura` (migration `20260831120000_lembrete_varredura`), que
   * libera **só leitura**, **só sem contexto** e **só de linhas pendentes**.
   *
   * Por isso o `select` traz apenas `id` e `tenantId`: é o suficiente para
   * montar o job, e todo o resto — nome e e-mail do cliente, gravação do
   * resultado — o worker lê já dentro do escopo da empresa.
   */
  private buscarVencidos(): Promise<{ id: string; tenantId: string }[]> {
    return this.prisma.semTenant(
      'varredura de lembretes vencidos: roda fora de requisição e precisa enxergar todas as empresas',
      (cliente) =>
        cliente.lembreteFollowUp.findMany({
          where: { status: 'pendente', dataEnvio: { lte: new Date() } },
          select: { id: true, tenantId: true },
          orderBy: { dataEnvio: 'asc' },
          take: LIMITE_POR_VARREDURA,
        }),
    );
  }
}
