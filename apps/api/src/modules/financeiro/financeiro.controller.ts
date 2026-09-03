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
  baixaFormSchema,
  categoriaFormSchema,
  lancamentoFormSchema,
  lancamentosQuerySchema,
  periodoQuerySchema,
  type BaixaFormInput,
  type CategoriaFinanceira,
  type CategoriaFormInput,
  type FluxoDeCaixa,
  type Lancamento,
  type LancamentoFormInput,
  type LancamentosQuery,
  type Paginado,
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
  constructor(private readonly financeiro: FinanceiroService) {}

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

  @Get('fluxo-de-caixa')
  fluxoDeCaixa(@QueryValidada(periodoQuerySchema) query: PeriodoQuery): Promise<FluxoDeCaixa> {
    return this.financeiro.fluxoDeCaixa(query);
  }

  @Get('margem')
  margem(@QueryValidada(periodoQuerySchema) query: PeriodoQuery): Promise<RelatorioMargem> {
    return this.financeiro.margemPorServico(query);
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
