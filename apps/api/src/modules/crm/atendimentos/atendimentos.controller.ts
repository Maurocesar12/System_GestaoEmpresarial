import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  atendimentoFormSchema,
  type Atendimento,
  type AtendimentoFormInput,
} from '@gestao/shared-types';
import { Papeis } from '../../../common/decorators/papeis.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AtendimentosService } from './atendimentos.service';

/**
 * Histórico de atendimentos.
 *
 * As rotas ficam sob `/clientes/:clienteId/atendimentos` porque um atendimento
 * não existe sozinho — ele é sempre de alguém. A URL refletir isso deixa a
 * relação óbvia para quem lê o código e para quem consome a API.
 */
@Controller('clientes/:clienteId/atendimentos')
@Papeis('admin', 'atendente', 'tecnico')
export class AtendimentosController {
  constructor(private readonly atendimentos: AtendimentosService) {}

  @Get()
  listar(@Param('clienteId', ParseUUIDPipe) clienteId: string): Promise<Atendimento[]> {
    return this.atendimentos.listarPorCliente(clienteId);
  }

  @Post()
  criar(
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
    @Body(new ZodValidationPipe(atendimentoFormSchema)) dados: AtendimentoFormInput,
  ): Promise<Atendimento> {
    return this.atendimentos.criar(clienteId, dados);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.atendimentos.remover(id);
  }
}
