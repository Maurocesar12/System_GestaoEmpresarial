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
  margemPercentual,
  servicoFormSchema,
  simulacaoMargemSchema,
  servicosQuerySchema,
  type Paginado,
  type Servico,
  type ServicoFormInput,
  type ServicosQuery,
  type SimulacaoMargem,
  type SimulacaoMargemInput,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ServicosService } from './servicos.service';

/**
 * Catálogo de serviços.
 *
 * Consultar é do time inteiro — quem monta um orçamento precisa da lista. Mas
 * **criar e alterar** é de `admin` e `financeiro`: o `custoBase` é o que define
 * a margem do negócio, e mexer nele muda como toda a lucratividade é calculada.
 */
@Controller('servicos')
@Permissoes('servicos.visualizar')
export class ServicosController {
  constructor(private readonly servicos: ServicosService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(servicosQuerySchema)) query: ServicosQuery,
  ): Promise<Paginado<Servico>> {
    return this.servicos.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<Servico> {
    return this.servicos.buscarPorId(id);
  }

  /** Prévia da margem enquanto se digita custo e preço. Não grava nada. */
  @Post('simular-margem')
  @Permissoes('servicos.gerenciar')
  @HttpCode(HttpStatus.OK)
  simularMargem(
    @Body(new ZodValidationPipe(simulacaoMargemSchema)) dados: SimulacaoMargemInput,
  ): SimulacaoMargem {
    const margem = margemPercentual(dados.custoBase, dados.precoPadrao);
    return { margemPercentual: margem, abaixoDoCusto: margem !== null && margem < 0 };
  }

  @Post()
  @Permissoes('servicos.gerenciar')
  criar(@Body(new ZodValidationPipe(servicoFormSchema)) dados: ServicoFormInput): Promise<Servico> {
    return this.servicos.criar(dados);
  }

  @Patch(':id')
  @Permissoes('servicos.gerenciar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(servicoFormSchema)) dados: ServicoFormInput,
  ): Promise<Servico> {
    return this.servicos.atualizar(id, dados);
  }

  @Delete(':id')
  @Permissoes('servicos.gerenciar')
  // Desativa, não apaga: orçamentos e lançamentos antigos apontam para este
  // serviço, e apagá-lo quebraria o histórico de margem.
  desativar(@Param('id', ParseUUIDPipe) id: string): Promise<Servico> {
    return this.servicos.desativar(id);
  }
}
