import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  type AcaoAuditoria,
  type AuditoriaQuery,
  type Paginado,
  type RegistroAuditoria,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';

interface RegistrarAuditoria {
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  resumo?: string;
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
        resumo: dados.resumo ?? this.montarResumo(dados),
        antes: dados.antes as Prisma.InputJsonValue | undefined,
        depois: dados.depois as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listar(query: AuditoriaQuery): Promise<Paginado<RegistroAuditoria>> {
    const where = this.montarFiltro(query);

    const registros = await this.prisma.comTenant(async (tx) => {
      const [logs, total] = await Promise.all([
        tx.logAuditoria.findMany({
          where,
          orderBy: { criadoEm: 'desc' },
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.logAuditoria.count({ where }),
      ]);

      const ids = [...new Set(logs.flatMap((item) => (item.usuarioId ? [item.usuarioId] : [])))];
      const usuarios = ids.length
        ? await tx.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, nome: true },
          })
        : [];
      return { logs, total, nomes: new Map(usuarios.map((item) => [item.id, item.nome])) };
    });

    return paginar(
      registros.logs.map((item) => ({
        id: item.id,
        usuarioId: item.usuarioId,
        usuarioNome: item.usuarioId
          ? (registros.nomes.get(item.usuarioId) ?? 'Usuário removido')
          : 'Sistema',
        entidade: item.entidade,
        entidadeId: item.entidadeId,
        acao: item.acao,
        resumo: item.resumo ?? this.montarResumo(item),
        antes: item.antes,
        depois: item.depois,
        criadoEm: item.criadoEm.toISOString(),
      })),
      registros.total,
      query,
    );
  }

  /**
   * Exclui um registro. Some da lista quem já não existe mais: 404.
   *
   * O 404 é o que distingue "outra pessoa apagou antes de você" de "apaguei" —
   * sem ele a tela confirmaria uma exclusão que não aconteceu.
   */
  async remover(id: string): Promise<void> {
    const removidos = await this.removerVarios([id]);

    if (removidos === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Histórico não encontrado.',
      });
    }
  }

  /**
   * Exclui um lote de registros e devolve quantos saíram de fato.
   *
   * Tudo numa transação só: apagar o histórico e registrar quem o apagou não
   * podem se separar — se a segunda parte falhasse, o rastro sumiria sem deixar
   * vestígio, que é exatamente o que a auditoria existe para impedir.
   *
   * Ids que não existem mais (ou são de outra empresa, que a RLS já esconde)
   * são simplesmente ignorados: o número devolvido conta só o que foi apagado
   * agora, e é ele que a tela usa para avisar o usuário.
   */
  async removerVarios(ids: readonly string[]): Promise<number> {
    const unicos = [...new Set(ids)];

    if (unicos.length === 0) return 0;

    return this.prisma.comTenant(async (tx) => {
      // Lê antes de apagar: o registro da exclusão guarda o conteúdo removido,
      // e depois do `delete` não haveria mais de onde tirá-lo.
      const registros = await tx.logAuditoria.findMany({
        where: { id: { in: unicos } },
        select: {
          id: true,
          usuarioId: true,
          entidade: true,
          entidadeId: true,
          acao: true,
          resumo: true,
          criadoEm: true,
        },
      });

      if (registros.length === 0) return 0;

      const { count } = await tx.logAuditoria.deleteMany({
        where: { id: { in: registros.map((registro) => registro.id) } },
      });

      for (const registro of registros) {
        await this.registrar(tx, {
          entidade: 'auditoria',
          entidadeId: registro.id,
          acao: 'excluiu',
          resumo: `Histórico excluído: ${registro.resumo ?? this.montarResumo(registro)}`,
          antes: { ...registro, criadoEm: registro.criadoEm.toISOString() },
        });
      }

      return count;
    });
  }

  private montarFiltro(query: AuditoriaQuery): Prisma.LogAuditoriaWhereInput {
    const where: Prisma.LogAuditoriaWhereInput = {};

    if (query.entidade) where.entidade = query.entidade;
    if (query.acao) where.acao = query.acao;

    if (query.de || query.ate) {
      where.criadoEm = {
        ...(query.de ? { gte: new Date(`${query.de}T00:00:00Z`) } : {}),
        ...(query.ate ? { lte: new Date(`${query.ate}T23:59:59.999Z`) } : {}),
      };
    }

    if (query.busca) {
      where.OR = [
        { resumo: { contains: query.busca, mode: 'insensitive' } },
        { entidade: { contains: query.busca, mode: 'insensitive' } },
        { acao: { contains: query.busca, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private montarResumo(dados: {
    entidade: string;
    acao: string;
    antes?: unknown;
    depois?: unknown;
  }): string {
    const partes = [
      dados.entidade.replace(/_/g, ' '),
      dados.acao,
      this.textoPesquisavel(dados.antes),
      this.textoPesquisavel(dados.depois),
    ].filter(Boolean);

    return partes.join(' · ').slice(0, 1_000);
  }

  private textoPesquisavel(valor: unknown): string {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
    if (valor instanceof Date) return valor.toISOString();
    if (Array.isArray(valor)) return valor.map((item) => this.textoPesquisavel(item)).join(' ');

    if (typeof valor === 'object') {
      return Object.entries(valor)
        .filter(([chave]) => !/senha|token|hash/i.test(chave))
        .map(([chave, item]) => `${chave}: ${this.textoPesquisavel(item)}`)
        .join(' ');
    }

    return '';
  }
}
