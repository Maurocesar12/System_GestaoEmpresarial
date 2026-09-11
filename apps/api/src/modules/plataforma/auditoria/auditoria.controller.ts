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
  type AuditoriaQuery,
  type Paginado,
  type RegistroAuditoria,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { QueryValidada } from '../../../common/decorators/validado.decorator';
import { AuditoriaService } from './auditoria.service';

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

  @Delete([':id', ',/:id'])
  @HttpCode(HttpStatus.NO_CONTENT)
  remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.auditoria.remover(id);
  }
}
