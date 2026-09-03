import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  mudarStatusSchema,
  orcamentoFormSchema,
  orcamentosQuerySchema,
  type MudarStatusInput,
  type Orcamento,
  type OrcamentoFormInput,
  type OrcamentosQuery,
  type Paginado,
  type ResumoOrcamentos,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { OrcamentosService } from './orcamentos.service';

@Controller('orcamentos')
@Permissoes('orcamentos.visualizar')
export class OrcamentosController {
  constructor(private readonly orcamentos: OrcamentosService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(orcamentosQuerySchema)) query: OrcamentosQuery,
  ): Promise<Paginado<Orcamento>> {
    return this.orcamentos.listar(query);
  }

  // Antes de `:id` de propósito: na ordem inversa, "resumo" seria interpretado
  // como um id e o ParseUUIDPipe recusaria a requisição.
  @Get('resumo')
  resumir(): Promise<ResumoOrcamentos> {
    return this.orcamentos.resumir();
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<Orcamento> {
    return this.orcamentos.buscarPorId(id);
  }

  @Post()
  @Permissoes('orcamentos.gerenciar')
  criar(
    @Body(new ZodValidationPipe(orcamentoFormSchema)) dados: OrcamentoFormInput,
  ): Promise<Orcamento> {
    return this.orcamentos.criar(dados);
  }

  @Patch(':id')
  @Permissoes('orcamentos.gerenciar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(orcamentoFormSchema)) dados: OrcamentoFormInput,
  ): Promise<Orcamento> {
    return this.orcamentos.atualizar(id, dados);
  }

  /** Aprovar, recusar ou reabrir — as transições da máquina de estados. */
  @Post(':id/status')
  @Permissoes('orcamentos.gerenciar')
  mudarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(mudarStatusSchema)) dados: MudarStatusInput,
  ): Promise<Orcamento> {
    return this.orcamentos.mudarStatus(id, dados.acao);
  }

  @Delete(':id')
  @Permissoes('orcamentos.gerenciar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.orcamentos.remover(id);
  }
}
