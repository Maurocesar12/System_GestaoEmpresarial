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
  agendamentoFormSchema,
  agendamentosQuerySchema,
  mudarStatusAgendamentoSchema,
  type Agendamento,
  type AgendamentoFormInput,
  type AgendamentosQuery,
  type MudarStatusAgendamentoInput,
  type Paginado,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AgendamentosService } from './agendamentos.service';

@Controller('agendamentos')
@Permissoes('agenda.visualizar')
export class AgendamentosController {
  constructor(private readonly agendamentos: AgendamentosService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(agendamentosQuerySchema)) query: AgendamentosQuery,
  ): Promise<Paginado<Agendamento>> {
    return this.agendamentos.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<Agendamento> {
    return this.agendamentos.buscarPorId(id);
  }

  @Post()
  @Permissoes('agenda.gerenciar')
  criar(
    @Body(new ZodValidationPipe(agendamentoFormSchema)) dados: AgendamentoFormInput,
  ): Promise<Agendamento> {
    return this.agendamentos.criar(dados);
  }

  @Patch(':id')
  @Permissoes('agenda.gerenciar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(agendamentoFormSchema)) dados: AgendamentoFormInput,
  ): Promise<Agendamento> {
    return this.agendamentos.atualizar(id, dados);
  }

  /** Confirmar, executar, cancelar ou reagendar. */
  @Post(':id/status')
  @Permissoes('agenda.gerenciar')
  mudarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(mudarStatusAgendamentoSchema))
    dados: MudarStatusAgendamentoInput,
  ): Promise<Agendamento> {
    return this.agendamentos.mudarStatus(id, dados.acao);
  }

  @Delete(':id')
  @Permissoes('agenda.gerenciar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.agendamentos.remover(id);
  }
}
