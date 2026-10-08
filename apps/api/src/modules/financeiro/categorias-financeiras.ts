import { BadRequestException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type CategoriaFinanceira,
  type CategoriaFormInput,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { tiposQueACategoriaServe } from './categoria-do-tipo';
import { naoEncontrado, conflito } from '../../common/erros';

/** Categorias do financeiro: listar, criar e remover. */

export async function listarCategorias(prisma: PrismaService): Promise<CategoriaFinanceira[]> {
  const categorias = await prisma.comTenant((tx) =>
    tx.categoriaFinanceira.findMany({ orderBy: { nome: 'asc' } }),
  );

  return categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    tipoCusto: categoria.tipoCusto,
    servePara: tiposQueACategoriaServe(categoria.tipoCusto),
    criadoEm: categoria.criadoEm.toISOString(),
  }));
}

export async function criarCategoria(
  prisma: PrismaService,
  dados: CategoriaFormInput,
): Promise<CategoriaFinanceira> {
  const categoria = await prisma.comTenant(async (tx) => {
    const existente = await tx.categoriaFinanceira.findFirst({
      where: { nome: dados.nome },
      select: { id: true },
    });

    if (existente) {
      throw conflito('Já existe uma categoria com este nome.');
    }

    return tx.categoriaFinanceira.create({
      data: { id: uuidv7(), tenantId: tenantAtual(), ...dados },
    });
  });

  return {
    id: categoria.id,
    nome: categoria.nome,
    tipoCusto: categoria.tipoCusto,
    servePara: tiposQueACategoriaServe(categoria.tipoCusto),
    criadoEm: categoria.criadoEm.toISOString(),
  };
}

/**
 * Remove uma categoria.
 *
 * Recusa se houver lançamento usando. Apagar desvincularia registros do
 * passado, e o relatório de custo fixo do mês anterior mudaria sozinho.
 */
export async function removerCategoria(prisma: PrismaService, id: string): Promise<void> {
  await prisma.comTenant(async (tx) => {
    const emUso = await tx.lancamentoFinanceiro.count({ where: { categoriaId: id } });

    if (emUso > 0) {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: `Esta categoria tem ${emUso} lançamento(s). Reclassifique-os antes de excluí-la.`,
      });
    }

    const removidas = await tx.categoriaFinanceira.deleteMany({ where: { id } });

    if (removidas.count === 0) {
      throw naoEncontrado('Categoria não encontrada.');
    }
  });
}
