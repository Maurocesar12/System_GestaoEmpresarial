import type { CustoOperacional } from './custo-operacional';
import type {
  CategoriaFinanceira,
  FluxoDeCaixa,
  Lancamento,
  RelatorioMargem,
  ResumoContas,
} from './lancamentos';
import type { Paginado } from '../common/paginacao';

/**
 * Tudo que a tela do financeiro precisa, numa resposta só.
 *
 * ## Por que existe
 *
 * A página montava o painel com oito chamadas separadas à API. Elas até saíam
 * em paralelo, mas cada uma pagava o caminho inteiro: navegador → Vercel →
 * Render → Neon, mais a validação do token e a transação de isolamento. Em
 * hospedagem gratuita, com frontend e API em regiões diferentes, esse ida e
 * volta custa muito mais que as consultas em si.
 *
 * Aqui o trabalho é o mesmo — as consultas continuam em paralelo —, mas roda
 * tudo dentro da API, ao lado do banco. São oito viagens longas trocadas por
 * uma.
 *
 * ## O que NÃO mudou
 *
 * As rotas individuais continuam existindo. Esta é um atalho para quem precisa
 * do conjunto, não uma substituta: telas que querem só o fluxo de caixa devem
 * seguir chamando `/financeiro/fluxo-de-caixa`, sem carregar o resto junto.
 */
export interface PainelFinanceiro {
  fluxo: FluxoDeCaixa;
  custo: CustoOperacional;
  margem: RelatorioMargem;

  /** Os lançamentos do período filtrado, já paginados. */
  lancamentos: Paginado<Lancamento>;

  resumoContas: ResumoContas;

  /**
   * Contas em aberto da empresa: atrasadas primeiro, depois as a vencer.
   *
   * Vem pronta e concatenada porque a API sabe a ordem certa — e porque o
   * filtro aceita uma situação por vez, o que obrigava a tela a fazer duas
   * chamadas e juntar o resultado na mão.
   *
   * Só `natureza: 'empresa'`. Sem esse filtro uma conta pessoal apareceria na
   * lista sem entrar no total logo acima, e os dois números se contradiriam.
   */
  contasEmAberto: Lancamento[];

  /** Para o seletor de categoria dos filtros. */
  categorias: CategoriaFinanceira[];
}
