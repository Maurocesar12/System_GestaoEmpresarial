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
  categoriaFormSchema,
  lancamentoFormSchema,
  lancamentosQuerySchema,
  periodoQuerySchema,
  type CategoriaFinanceira,
  type CategoriaFormInput,
  type FluxoDeCaixa,
  type Lancamento,
  type LancamentoFormInput,
  type LancamentosQuery,
  type Paginado,
  type PeriodoQuery,
  type RelatorioMargem,
} from '@gestao/shared-types';
import { Papeis } from '../../common/decorators/papeis.decorator';
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
@Papeis('admin', 'financeiro')
export class FinanceiroController {
  constructor(private readonly financeiro: FinanceiroService) {}

  // --- Categorias ----------------------------------------------------------

  @Get('categorias')
  listarCategorias(): Promise<CategoriaFinanceira[]> {
    return this.financeiro.listarCategorias();
  }

  @Post('categorias')
  criarCategoria(
    @CorpoValidado(categoriaFormSchema) dados: CategoriaFormInput,
  ): Promise<CategoriaFinanceira> {
    return this.financeiro.criarCategoria(dados);
  }

  @Delete('categorias/:id')
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

  // --- Lançamentos ---------------------------------------------------------

  @Get('lancamentos')
  listar(
    @QueryValidada(lancamentosQuerySchema) query: LancamentosQuery,
  ): Promise<Paginado<Lancamento>> {
    return this.financeiro.listar(query);
  }

  @Get('lancamentos/:id')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<Lancamento> {
    return this.financeiro.buscarPorId(id);
  }

  @Post('lancamentos')
  criar(@CorpoValidado(lancamentoFormSchema) dados: LancamentoFormInput): Promise<Lancamento> {
    return this.financeiro.criar(dados);
  }

  @Patch('lancamentos/:id')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(lancamentoFormSchema) dados: LancamentoFormInput,
  ): Promise<Lancamento> {
    return this.financeiro.atualizar(id, dados);
  }

  @Delete('lancamentos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.financeiro.remover(id);
  }
}
