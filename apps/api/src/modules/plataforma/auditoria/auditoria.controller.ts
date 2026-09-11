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
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { CorpoValidado, QueryValidada } from '../../../common/decorators/validado.decorator';
import { AuditoriaService } from './auditoria.service';

/**
 * Rotas do histórico.
 *
 * Ler é a permissão padrão do controller; excluir exige a sua própria. Quem
 * consulta o histórico não ganha, de brinde, o direito de apagar o rastro do
 * que aconteceu na empresa.
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
  @Permissoes('auditoria.excluir')
  async removerVarios(
    @CorpoValidado(exclusaoHistoricoSchema) { ids }: ExclusaoHistoricoInput,
  ): Promise<ResultadoExclusaoHistorico> {
    return { removidos: await this.auditoria.removerVarios(ids) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissoes('auditoria.excluir')
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.auditoria.remover(id);
  }
}
