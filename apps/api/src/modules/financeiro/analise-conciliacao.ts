import { BadRequestException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type AnaliseConciliacaoInput,
  type ConciliacaoAnalisada,
} from '@gestao/shared-types';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  ColunasNaoEncontradas,
  extrairMovimentacoes,
  sugerirVinculos,
  type ContaEmAberto,
} from './conciliacao';
import { paraDia } from './datas';

/**
 * Conciliação bancária: confronta o extrato com as contas em aberto.
 *
 * A leitura do extrato e a sugestão de vínculo são puras e moram em
 * `conciliacao.ts`; aqui fica só a parte que busca as contas no banco.
 */

/** Quantas contas em aberto entram na conciliação, das que vencem antes. */
const LIMITE_CONTAS_CONCILIACAO = 500;

/**
 * Lê o extrato e sugere com qual conta em aberto cada movimentação bate.
 *
 * Não grava nada: conciliar é dar baixa na conta escolhida, pela rota de
 * baixa de sempre. As contas vêm do banco aqui mesmo — a tela passava as que
 * tinha carregado, até cem por situação.
 */
export async function analisarConciliacao(
  prisma: PrismaService,
  dados: AnaliseConciliacaoInput,
): Promise<ConciliacaoAnalisada> {
  let extraidas: ReturnType<typeof extrairMovimentacoes>;

  try {
    extraidas = extrairMovimentacoes(dados.cabecalhos, dados.linhas);
  } catch (erro) {
    if (erro instanceof ColunasNaoEncontradas) {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: erro.message,
        detalhes: { cabecalhos: [erro.message] },
      });
    }
    throw erro;
  }

  const abertas = await prisma.comTenant((tx) =>
    tx.lancamentoFinanceiro.findMany({
      where: { pagoEm: null, natureza: 'empresa' },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        valor: true,
        data: true,
        vencimento: true,
      },
      orderBy: [{ vencimento: 'asc' }, { data: 'asc' }],
      take: LIMITE_CONTAS_CONCILIACAO,
    }),
  );

  const contas: ContaEmAberto[] = abertas.map((conta) => ({
    id: conta.id,
    tipo: conta.tipo,
    descricao: conta.descricao,
    valor: conta.valor,
    referencia: paraDia(conta.vencimento ?? conta.data)!,
  }));

  return {
    movimentacoes: sugerirVinculos(extraidas.movimentacoes, contas),
    ignoradas: extraidas.ignoradas,
    contasEmAberto: contas.length,
  };
}
