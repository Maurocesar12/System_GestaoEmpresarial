import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  auditoriaQuerySchema,
  exclusaoHistoricoSchema,
  type AuditoriaQuery,
  type ExclusaoHistoricoInput,
  type Paginado,
  type RegistroAuditoria,
  type ResultadoExclusaoHistorico,
} from '@gestao/shared-types';
import { Papeis } from '../../../common/decorators/papeis.decorator';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { CorpoValidado, QueryValidada } from '../../../common/decorators/validado.decorator';
import { AuditoriaService } from './auditoria.service';

/**
 * Rotas do histórico.
 *
 * Ler depende da permissão de auditoria; excluir é do administrador, e só.
 *
 * Excluir não virou permissão concedível de propósito: o histórico é o que
 * prova o que cada funcionário fez, e um funcionário que pode apagá-lo pode
 * apagar o próprio rastro. Como papel, a regra não depende de ninguém lembrar
 * de desmarcar uma caixa na tela de equipe.
 */
@Controller('auditoria')
@Permissoes('auditoria.visualizar')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(
    @QueryValidada(auditoriaQuerySchema) query: AuditoriaQuery,
  ): Promise<Paginado<RegistroAuditoria>> {
    return this.auditoria.listar(query);
  }

  /**
   * Exclui vários de uma vez.
   *
   * Um `DELETE` por linha selecionada seria N requisições que podem falhar pela
   * metade, deixando a tela sem saber o que sobrou. Aqui o lote inteiro vive ou
   * morre junto, e a resposta diz quantos registros saíram de fato.
   */
  @Delete()
  @Papeis('admin')
  async removerVarios(
    @CorpoValidado(exclusaoHistoricoSchema) { ids }: ExclusaoHistoricoInput,
  ): Promise<ResultadoExclusaoHistorico> {
    return { removidos: await this.auditoria.removerVarios(ids) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Papeis('admin')
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.auditoria.remover(id);
  }
}
