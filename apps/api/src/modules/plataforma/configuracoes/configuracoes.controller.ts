import { Controller, Get, Put } from '@nestjs/common';
import {
  configuracoesEmpresaSchema,
  type ConfiguracoesEmpresa,
  type ConfiguracoesEmpresaInput,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { CorpoValidado } from '../../../common/decorators/validado.decorator';
import { ConfiguracoesService } from './configuracoes.service';

@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly configuracoes: ConfiguracoesService) {}
  @Get() buscar(): Promise<ConfiguracoesEmpresa> {
    return this.configuracoes.buscar();
  }
  @Put()
  @Permissoes('empresa.configurar')
  salvar(
    @CorpoValidado(configuracoesEmpresaSchema) dados: ConfiguracoesEmpresaInput,
  ): Promise<ConfiguracoesEmpresa> {
    return this.configuracoes.salvar(dados);
  }
}
