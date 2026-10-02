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
  recorrenciaFormSchema,
  type LancamentoRecorrente,
  type ResumoRecorrencias,
  type RecorrenciaFormInput,
} from '@gestao/shared-types';
import { z } from 'zod';
import { Permissoes } from '../../common/decorators/permissoes.decorator';
import { CorpoValidado } from '../../common/decorators/validado.decorator';
import { RecorrenciaService } from './recorrencia.service';

const alternarSchema = z.object({ ativo: z.boolean() });

@Controller('financeiro/recorrencias')
@Permissoes('financeiro.visualizar')
export class RecorrenciaController {
  constructor(private readonly recorrencias: RecorrenciaService) {}

  @Get()
  listar(): Promise<LancamentoRecorrente[]> {
    return this.recorrencias.listar();
  }

  @Get('resumo')
  resumir(): Promise<ResumoRecorrencias> {
    return this.recorrencias.resumir();
  }

  @Post()
  @Permissoes('financeiro.criar')
  criar(
    @CorpoValidado(recorrenciaFormSchema) dados: RecorrenciaFormInput,
  ): Promise<LancamentoRecorrente> {
    return this.recorrencias.criar(dados);
  }

  /**
   * Pausa ou retoma. É `PATCH` com o estado desejado no corpo, e não dois
   * verbos, porque a tela tem um interruptor — e um interruptor manda o estado
   * que quer, não a transição.
   */
  @Patch(':id/ativo')
  @Permissoes('financeiro.editar')
  alternarAtivo(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(alternarSchema) dados: z.infer<typeof alternarSchema>,
  ): Promise<LancamentoRecorrente> {
    return this.recorrencias.alternarAtivo(id, dados.ativo);
  }

  /** Apaga o molde. Os lançamentos já gerados ficam, só perdem o vínculo. */
  @Delete(':id')
  @Permissoes('financeiro.excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.recorrencias.remover(id);
  }
}
