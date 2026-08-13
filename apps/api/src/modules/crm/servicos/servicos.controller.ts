import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  servicoFormSchema,
  servicosQuerySchema,
  type Paginado,
  type Servico,
  type ServicoFormInput,
  type ServicosQuery,
} from '@gestao/shared-types';
import { Papeis } from '../../../common/decorators/papeis.decorator';
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
@Papeis('admin', 'financeiro', 'atendente', 'tecnico')
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

  @Post()
  @Papeis('admin', 'financeiro')
  criar(@Body(new ZodValidationPipe(servicoFormSchema)) dados: ServicoFormInput): Promise<Servico> {
    return this.servicos.criar(dados);
  }

  @Patch(':id')
  @Papeis('admin', 'financeiro')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(servicoFormSchema)) dados: ServicoFormInput,
  ): Promise<Servico> {
    return this.servicos.atualizar(id, dados);
  }

  @Delete(':id')
  @Papeis('admin', 'financeiro')
  // Desativa, não apaga: orçamentos e lançamentos antigos apontam para este
  // serviço, e apagá-lo quebraria o histórico de margem.
  desativar(@Param('id', ParseUUIDPipe) id: string): Promise<Servico> {
    return this.servicos.desativar(id);
  }
}
