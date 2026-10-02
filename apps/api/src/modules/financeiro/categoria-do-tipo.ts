import { BadRequestException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  ROTULO_TIPO_CUSTO,
  TIPOS_CUSTO_POR_LANCAMENTO,
  type TipoCusto,
  type TipoLancamento,
} from '@gestao/shared-types';
import type { TransacaoComTenant } from '../../infra/prisma/prisma.service';

/** Para quais tipos de lançamento uma categoria serve. Vai na resposta de cada categoria. */
export function tiposQueACategoriaServe(tipoCusto: TipoCusto): TipoLancamento[] {
  return (Object.keys(TIPOS_CUSTO_POR_LANCAMENTO) as TipoLancamento[]).filter((tipo) =>
    (TIPOS_CUSTO_POR_LANCAMENTO[tipo] as readonly TipoCusto[]).includes(tipoCusto),
  );
}

/**
 * Recusa uma entrada classificada como custo, ou uma saída como receita.
 *
 * A regra existia só no seletor da tela: uma chamada direta à API gravava
 * receita como custo fixo, e o custo por dia e a margem por serviço saíam
 * errados sem nenhum sinal. Agora quem decide é a API.
 *
 * @param categoriaAnterior A categoria que o registro já tinha. Lançamentos
 *   criados antes desta regra podem apontar para uma categoria do tipo errado;
 *   mantê-la ao editar outro campo é aceito — recusar travaria a edição de um
 *   dado antigo por um motivo que a pessoa nem está mexendo. Trocar para outra
 *   categoria incompatível, não.
 */
export async function garantirCategoriaDoTipo(
  tx: TransacaoComTenant,
  dados: { tipo: TipoLancamento; categoriaId: string | null },
  categoriaAnterior: string | null = null,
): Promise<void> {
  if (!dados.categoriaId || dados.categoriaId === categoriaAnterior) return;

  const categoria = await tx.categoriaFinanceira.findUnique({
    where: { id: dados.categoriaId },
    select: { tipoCusto: true },
  });

  // Inexistente é com `garantirVinculos`, que já responde 404.
  if (!categoria) return;

  const servem = TIPOS_CUSTO_POR_LANCAMENTO[dados.tipo] as readonly TipoCusto[];

  if (!servem.includes(categoria.tipoCusto)) {
    const mensagem =
      dados.tipo === 'entrada'
        ? `Esta categoria é de ${ROTULO_TIPO_CUSTO[categoria.tipoCusto].toLowerCase()} e não serve para uma entrada. Escolha uma categoria de receita.`
        : 'Esta categoria é de receita e não serve para uma saída. Escolha uma categoria de custo fixo ou variável.';

    throw new BadRequestException({
      codigo: CODIGOS_ERRO.VALIDACAO,
      mensagem,
      detalhes: { categoriaId: [mensagem] },
    });
  }
}
