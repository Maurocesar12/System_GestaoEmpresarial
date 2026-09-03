import { Controller, Get } from '@nestjs/common';
import type { RegistroAuditoria } from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { AuditoriaService } from './auditoria.service';

@Controller('auditoria')
@Permissoes('auditoria.visualizar')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(): Promise<RegistroAuditoria[]> {
    return this.auditoria.listar();
  }
}
