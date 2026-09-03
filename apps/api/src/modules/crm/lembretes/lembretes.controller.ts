import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  lembreteFormSchema,
  lembretesQuerySchema,
  type LembreteFollowUp,
  type LembreteFormInput,
  type LembretesQuery,
  type Paginado,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LembretesService } from './lembretes.service';

@Controller('lembretes')
@Permissoes('lembretes.visualizar')
export class LembretesController {
  constructor(private readonly lembretes: LembretesService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(lembretesQuerySchema)) query: LembretesQuery,
  ): Promise<Paginado<LembreteFollowUp>> {
    return this.lembretes.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<LembreteFollowUp> {
    return this.lembretes.buscarPorId(id);
  }

  @Post()
  @Permissoes('lembretes.gerenciar')
  criar(
    @Body(new ZodValidationPipe(lembreteFormSchema)) dados: LembreteFormInput,
  ): Promise<LembreteFollowUp> {
    return this.lembretes.criar(dados);
  }

  @Post(':id/cancelar')
  @Permissoes('lembretes.gerenciar')
  cancelar(@Param('id', ParseUUIDPipe) id: string): Promise<LembreteFollowUp> {
    return this.lembretes.cancelar(id);
  }
}
