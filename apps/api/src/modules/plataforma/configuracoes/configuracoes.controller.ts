import { Controller, Get, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  configuracoesEmpresaSchema,
  testeEmailSchema,
  type ConfiguracoesEmpresa,
  type ConfiguracoesEmpresaInput,
  type TesteEmailInput,
  type TesteEmailResponse,
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

  @Post('email/testar')
  @Permissoes('empresa.configurar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  testarEmail(
    @CorpoValidado(testeEmailSchema) dados: TesteEmailInput,
  ): Promise<TesteEmailResponse> {
    return this.configuracoes.testarEmail(dados);
  }
}
