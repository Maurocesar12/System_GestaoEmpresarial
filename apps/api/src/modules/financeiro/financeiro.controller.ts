import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  analiseConciliacaoSchema,
  baixaFormSchema,
  categoriaFormSchema,
  dividirEmParcelas,
  lancamentoFormSchema,
  simulacaoParcelasSchema,
  lancamentosQuerySchema,
  periodoQuerySchema,
  type AnaliseConciliacaoInput,
  type BaixaFormInput,
  type ConciliacaoAnalisada,
  type CategoriaFinanceira,
  type CategoriaFormInput,
  type CustoOperacional,
  type FluxoDeCaixa,
  type Lancamento,
  type LancamentoFormInput,
  type SimulacaoParcelas,
  type SimulacaoParcelasInput,
  type LancamentosQuery,
  LANCAMENTOS_POR_PAGINA,
  painelFinanceiroQuerySchema,
  type Paginado,
  type PainelFinanceiro,
  type PainelFinanceiroQuery,
  type PeriodoQuery,
  type RelatorioMargem,
  type ResumoContas,
  importacaoLancamentosSchema,
  type ImportacaoLancamentosInput,
  type ResultadoImportacaoLancamentos,
  type ExportacaoFinanceira,
} from '@gestao/shared-types';
import { Permissoes } from '../../common/decorators/permissoes.decorator';
import { CorpoValidado, QueryValidada } from '../../common/decorators/validado.decorator';
import { FinanceiroService } from './financeiro.service';
import { ProLaboreService } from './pro-labore.service';

/**
 * Rotas do financeiro.
 *
 * Restritas a `admin` e `financeiro` (arquitetura §9.5). Quem atende cliente ou
 * executa serviço não precisa ver o caixa da empresa — e a separação existe
 * justamente para que o dono possa dar acesso ao sistema sem expor o quanto
 * ganha.
 */
@Controller('financeiro')
@Permissoes('financeiro.visualizar')
export class FinanceiroController {
  // O `ProLaboreService` entra aqui, e não no `FinanceiroService`, porque ele já
  // depende deste último: injetar o contrário fecharia um ciclo. Compor os dois
  // serviços no controller é o que mantém a rota onde o usuário a procura.
  constructor(
    private readonly financeiro: FinanceiroService,
    private readonly proLabore: ProLaboreService,
  ) {}

  // --- Categorias ----------------------------------------------------------

  @Get('categorias')
  listarCategorias(): Promise<CategoriaFinanceira[]> {
    return this.financeiro.listarCategorias();
  }

  @Post('categorias')
  @Permissoes('financeiro.criar')
  criarCategoria(
    @CorpoValidado(categoriaFormSchema) dados: CategoriaFormInput,
  ): Promise<CategoriaFinanceira> {
    return this.financeiro.criarCategoria(dados);
  }

  @Delete('categorias/:id')
  @Permissoes('financeiro.excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerCategoria(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.financeiro.removerCategoria(id);
  }

  // --- Relatórios ----------------------------------------------------------
  // Declarados antes de `:id` de propósito: na ordem inversa, "fluxo-de-caixa"
  // seria interpretado como um id e o ParseUUIDPipe recusaria a requisição.

  /**
   * Tudo que a tela do financeiro mostra, numa resposta só.
   *
   * A tela fazia oito chamadas para montar o painel. Em paralelo, mas cada uma
   * atravessando Vercel → Render → Neon por conta própria. Aqui as mesmas oito
   * consultas rodam igualmente em paralelo, só que dentro da API, ao lado do
   * banco: o que era caro (a viagem entre regiões) acontece uma vez.
   *
   * A composição fica no controller, e não num service, pelo mesmo motivo
   * explicado no construtor: `ProLaboreService` já depende de
   * `FinanceiroService`, e juntá-los do outro lado fecharia um ciclo.
   */
  @Get('painel')
  async painel(
    @QueryValidada(painelFinanceiroQuerySchema) query: PainelFinanceiroQuery,
  ): Promise<PainelFinanceiro> {
    // A página é só da lista de lançamentos. Os relatórios acima dela somam o
    // período inteiro, então recebem o filtro sem ela.
    const { pagina, ...periodo } = query;

    // As contas em aberto saem em duas consultas porque o filtro aceita uma
    // situação por vez. `natureza: 'empresa'` nas duas não é detalhe: o resumo
    // é calculado só sobre a empresa, e sem o filtro uma conta pessoal
    // apareceria na lista sem entrar no total logo acima.
    const contasEmAberto = { natureza: 'empresa', porPagina: 10, pagina: 1 } as const;

    const [fluxo, custo, margem, lancamentos, resumoContas, atrasadas, aVencer, categorias] =
      await Promise.all([
        this.financeiro.fluxoDeCaixa(periodo),
        this.proLabore.custoOperacional(periodo),
        this.financeiro.margemPorServico(periodo),
        this.financeiro.listar({ ...periodo, porPagina: LANCAMENTOS_POR_PAGINA, pagina }),
        this.financeiro.resumoContas(),
        this.financeiro.listar({ ...contasEmAberto, status: 'atrasado' }),
        this.financeiro.listar({ ...contasEmAberto, status: 'a_vencer' }),
        this.financeiro.listarCategorias(),
      ]);

    return {
      fluxo,
      custo,
      margem,
      lancamentos,
      resumoContas,
      // Atrasadas primeiro: é a ordem em que o dono precisa resolver.
      contasEmAberto: [...atrasadas.dados, ...aVencer.dados],
      categorias,
    };
  }

  @Get('fluxo-de-caixa')
  fluxoDeCaixa(@QueryValidada(periodoQuerySchema) query: PeriodoQuery): Promise<FluxoDeCaixa> {
    return this.financeiro.fluxoDeCaixa(query);
  }

  @Get('margem')
  margem(@QueryValidada(periodoQuerySchema) query: PeriodoQuery): Promise<RelatorioMargem> {
    return this.financeiro.margemPorServico(query);
  }

  /** Quanto o negócio custa por dia só para existir: custo fixo + pró-labore. */
  @Get('custo-operacional')
  custoOperacional(
    @QueryValidada(periodoQuerySchema) query: PeriodoQuery,
  ): Promise<CustoOperacional> {
    return this.proLabore.custoOperacional(query);
  }

  /** Quanto há a receber e a pagar em aberto, e quanto disso já venceu. */
  @Get('contas/resumo')
  resumoContas(): Promise<ResumoContas> {
    return this.financeiro.resumoContas();
  }

  // --- Lançamentos ---------------------------------------------------------

  @Get('lancamentos')
  listar(
    @QueryValidada(lancamentosQuerySchema) query: LancamentosQuery,
  ): Promise<Paginado<Lancamento>> {
    return this.financeiro.listar(query);
  }

  @Get('dados/exportar')
  @Permissoes('financeiro.exportar')
  exportar(@QueryValidada(periodoQuerySchema) query: PeriodoQuery): Promise<ExportacaoFinanceira> {
    return this.financeiro.exportar(query);
  }

  @Post('dados/importar')
  @Permissoes('financeiro.importar')
  importar(
    @CorpoValidado(importacaoLancamentosSchema) dados: ImportacaoLancamentosInput,
  ): Promise<ResultadoImportacaoLancamentos> {
    return this.financeiro.importar(dados);
  }

  @Get('lancamentos/:id')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<Lancamento> {
    return this.financeiro.buscarPorId(id);
  }

  /** Lê o extrato e sugere os vínculos com as contas em aberto. Não grava nada. */
  @Post('conciliacao/analisar')
  @HttpCode(HttpStatus.OK)
  analisarConciliacao(
    @CorpoValidado(analiseConciliacaoSchema) dados: AnaliseConciliacaoInput,
  ): Promise<ConciliacaoAnalisada> {
    return this.financeiro.analisarConciliacao(dados);
  }

  /** Prévia do parcelamento: divide como `criar` vai dividir, sem gravar nada. */
  @Post('lancamentos/simular-parcelas')
  @Permissoes('financeiro.criar')
  @HttpCode(HttpStatus.OK)
  simularParcelas(
    @CorpoValidado(simulacaoParcelasSchema) dados: SimulacaoParcelasInput,
  ): SimulacaoParcelas {
    const partes = dividirEmParcelas(dados.valor, dados.parcelas);
    const primeira = partes[0]!;
    const ultima = partes[partes.length - 1]!;

    return {
      quantidade: dados.parcelas,
      valorParcela: primeira,
      ultimaParcela: ultima === primeira ? null : ultima,
    };
  }

  @Post('lancamentos')
  @Permissoes('financeiro.criar')
  criar(@CorpoValidado(lancamentoFormSchema) dados: LancamentoFormInput): Promise<Lancamento> {
    return this.financeiro.criar(dados);
  }

  @Patch('lancamentos/:id')
  @Permissoes('financeiro.editar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(lancamentoFormSchema) dados: LancamentoFormInput,
  ): Promise<Lancamento> {
    return this.financeiro.atualizar(id, dados);
  }

  /**
   * Dar baixa: registrar que o dinheiro entrou ou saiu.
   *
   * `POST` numa sub-rota, e não um `PATCH` no lançamento, porque é uma ação de
   * negócio com regra própria — recusa baixa repetida — e não a edição de um
   * campo qualquer.
   */
  @Post('lancamentos/:id/baixa')
  @Permissoes('financeiro.editar')
  darBaixa(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(baixaFormSchema) dados: BaixaFormInput,
  ): Promise<Lancamento> {
    return this.financeiro.darBaixa(id, dados);
  }

  @Post('lancamentos/:id/estornar-baixa')
  @Permissoes('financeiro.editar')
  estornarBaixa(@Param('id', ParseUUIDPipe) id: string): Promise<Lancamento> {
    return this.financeiro.estornarBaixa(id);
  }

  @Delete('lancamentos/:id')
  @Permissoes('financeiro.excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.financeiro.remover(id);
  }
}
