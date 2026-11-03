import { conflito } from './erros';

/*
 * Compare-and-set: gravar só se o registro ainda está como foi lido.
 *
 * As transações rodam em READ COMMITTED, então ler o estado, decidir e gravar
 * dentro da mesma transação NÃO impede que outra requisição mude o registro no
 * meio. A saída é pôr o estado esperado no próprio `where` da gravação: o
 * Postgres reavalia a condição depois de esperar o lock da linha, e a perdedora
 * não casa com nada.
 *
 *   await gravarSeNaoMudou(
 *     tx.orcamento.update({ where: { id, status: atual.status }, data }),
 *   );
 */

const MENSAGEM_PADRAO =
  'Este registro foi alterado por outra pessoa agora há pouco. Atualize a tela e confira antes de tentar de novo.';

/*
 * Controle otimista por versão (cabeçalho `If-Match`).
 *
 * Quando a tela manda a versão que abriu, ela entra no `where` do `update`
 * (`filtroDeVersao`) e a gravação sobe a versão (`VERSAO_SUBIU`). Quem salva com
 * a versão antiga não casa com nada e recebe 409 em vez de apagar, sem aviso, a
 * edição que outra pessoa fez no meio.
 *
 *   await gravarSeNaoMudou(
 *     tx.servico.update({
 *       where: { id, ...filtroDeVersao(versao) },
 *       data: { ...dados, ...VERSAO_SUBIU },
 *     }),
 *     MENSAGEM_VERSAO,
 *   );
 *
 * Todo caminho que muda o registro por outro lugar (baixa, desativar) também
 * sobe a versão: a tela de edição aberta antes dele precisa perder.
 */

/** Soma 1 à versão no mesmo `UPDATE`. */
export const VERSAO_SUBIU = { versao: { increment: 1 } } as const;

/** O pedaço do `where` que exige a versão — vazio quando a tela não mandou uma. */
export function filtroDeVersao(versao: number | undefined): { versao?: number } {
  return versao === undefined ? {} : { versao };
}

export const MENSAGEM_VERSAO =
  'Este registro foi alterado por outra pessoa depois que você abriu a tela. Recarregue para ver as mudanças antes de salvar.';

/** O Prisma recusou o `update`/`delete` porque nenhuma linha casou com o `where` (P2025). */
export function nenhumaLinhaCasou(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2025';
}

/**
 * Aguarda um `update` condicional e converte "nenhuma linha casou" em 409.
 *
 * Serve para `update` (devolve a linha, então mantém `include`). Para
 * `updateMany`/`deleteMany`, que não lançam, use `exigirLinhaAfetada`.
 */
export async function gravarSeNaoMudou<T>(
  gravacao: PromiseLike<T>,
  mensagem: string = MENSAGEM_PADRAO,
): Promise<T> {
  try {
    return await gravacao;
  } catch (erro) {
    if (nenhumaLinhaCasou(erro)) {
      throw conflito(mensagem);
    }

    throw erro;
  }
}

/** Para `updateMany`/`deleteMany` condicionais: `count === 0` é a corrida perdida. */
export function exigirLinhaAfetada(
  resultado: { count: number },
  mensagem: string = MENSAGEM_PADRAO,
): void {
  if (resultado.count === 0) {
    throw conflito(mensagem);
  }
}
