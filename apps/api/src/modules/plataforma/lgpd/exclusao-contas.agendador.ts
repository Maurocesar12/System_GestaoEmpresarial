import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DIAS_PARA_EXCLUIR_CONTA_CANCELADA } from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Contas apagadas por passagem. O que sobrar entra na do dia seguinte. */
const LIMITE_POR_PASSAGEM = 50;

/**
 * Apaga os dados das contas canceladas há mais que o prazo publicado.
 *
 * Cada empresa é apagada numa transação própria, dentro do contexto dela: a
 * RLS continua valendo, e a falha de uma não impede as outras. O `ON DELETE
 * CASCADE` de todas as tabelas leva junto clientes, financeiro, usuários e
 * histórico.
 */
@Injectable()
export class ExclusaoContasAgendador {
  private readonly logger = new Logger(ExclusaoContasAgendador.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'America/Sao_Paulo' })
  async executar(): Promise<void> {
    try {
      const excluidas = await this.excluirVencidas();

      if (excluidas > 0) {
        this.logger.log(`${excluidas} conta(s) cancelada(s) excluída(s) definitivamente.`);
      }
    } catch (erro) {
      // Roda de novo amanhã; derrubar o processo não apagaria nada mais cedo.
      this.logger.error(
        `Falha na exclusão de contas canceladas: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
    }
  }

  async excluirVencidas(agora: Date = new Date()): Promise<number> {
    const corte = new Date(agora.getTime() - DIAS_PARA_EXCLUIR_CONTA_CANCELADA * DIA_MS);

    // Permitido pela política `tenant_expurgo`: sem contexto, só empresas
    // canceladas são visíveis (migration `20260915120000_lgpd`).
    const vencidas = await this.prisma.semTenant(
      'exclusão de contas canceladas: roda fora de requisição e precisa achar as vencidas',
      (db) =>
        db.tenant.findMany({
          where: { status: 'cancelado', canceladoEm: { lte: corte } },
          select: { id: true, canceladoEm: true },
          orderBy: { canceladoEm: 'asc' },
          take: LIMITE_POR_PASSAGEM,
        }),
    );

    let excluidas = 0;

    for (const conta of vencidas) {
      if (!conta.canceladoEm) continue;
      const canceladoEm = conta.canceladoEm;

      try {
        const apagou = await this.prisma.comTenantExplicito(conta.id, async (tx) => {
          // Confere o status de novo na própria exclusão: se o suporte
          // reativou a conta desde a busca, ela não pode ir embora.
          const { count } = await tx.tenant.deleteMany({
            where: { id: conta.id, status: 'cancelado' },
          });

          if (count === 0) return false;

          await tx.registroExclusaoConta.create({
            data: { id: uuidv7(), tenantId: conta.id, canceladoEm },
          });

          return true;
        });

        if (apagou) excluidas++;
      } catch (erro) {
        this.logger.error(
          `Não foi possível excluir a conta ${conta.id}: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
      }
    }

    return excluidas;
  }
}
