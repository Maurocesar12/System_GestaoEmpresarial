import { Injectable } from '@nestjs/common';
import type { RegistroAuditoria } from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';

interface RegistrarAuditoria {
  entidade: string;
  entidadeId: string;
  acao: 'criou' | 'alterou' | 'excluiu' | 'movimentou' | 'convidou' | 'desativou';
  antes?: unknown;
  depois?: unknown;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Grava na mesma transação da mudança: ação e histórico nunca divergem. */
  registrar(tx: TransacaoComTenant, dados: RegistrarAuditoria): Promise<unknown> {
    const contexto = exigirContextoTenant();
    return tx.logAuditoria.create({
      data: {
        id: uuidv7(),
        tenantId: tenantAtual(),
        usuarioId: contexto.usuarioId,
        entidade: dados.entidade,
        entidadeId: dados.entidadeId,
        acao: dados.acao,
        antes: dados.antes as Prisma.InputJsonValue | undefined,
        depois: dados.depois as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listar(): Promise<RegistroAuditoria[]> {
    const registros = await this.prisma.comTenant(async (tx) => {
      const logs = await tx.logAuditoria.findMany({
        orderBy: { criadoEm: 'desc' },
        take: 200,
      });
      const ids = [...new Set(logs.flatMap((item) => (item.usuarioId ? [item.usuarioId] : [])))];
      const usuarios = ids.length
        ? await tx.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, nome: true },
          })
        : [];
      return { logs, nomes: new Map(usuarios.map((item) => [item.id, item.nome])) };
    });

    return registros.logs.map((item) => ({
      id: item.id,
      usuarioId: item.usuarioId,
      usuarioNome: item.usuarioId
        ? (registros.nomes.get(item.usuarioId) ?? 'Usuário removido')
        : 'Sistema',
      entidade: item.entidade,
      entidadeId: item.entidadeId,
      acao: item.acao,
      antes: item.antes,
      depois: item.depois,
      criadoEm: item.criadoEm.toISOString(),
    }));
  }
}
