import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  cancelamentoContaSchema,
  type CancelamentoContaInput,
  type ContaCancelada,
  type DadosDoTitular,
  type ExportacaoEmpresa,
} from '@gestao/shared-types';
import { Papeis } from '../../../common/decorators/papeis.decorator';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { CorpoValidado } from '../../../common/decorators/validado.decorator';
import { LgpdService } from './lgpd.service';

@Controller()
export class LgpdController {
  constructor(private readonly lgpd: LgpdService) {}

  @Get('clientes/:id/dados-pessoais')
  @Permissoes('clientes.dados_pessoais')
  dadosDoTitular(@Param('id', ParseUUIDPipe) id: string): Promise<DadosDoTitular> {
    return this.lgpd.dadosDoTitular(id);
  }

  @Post('clientes/:id/anonimizar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissoes('clientes.dados_pessoais')
  async anonimizar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.lgpd.anonimizarCliente(id);
  }

  // Exportar e cancelar a conta são decisões do dono, e não permissões que se
  // concedem a funcionário na tela de equipe.
  @Get('conta/exportar')
  @Papeis('admin')
  exportarEmpresa(): Promise<ExportacaoEmpresa> {
    return this.lgpd.exportarEmpresa();
  }

  @Post('conta/cancelar')
  @HttpCode(HttpStatus.OK)
  @Papeis('admin')
  // Pede a senha: sem limite próprio, viraria um jeito de testar senhas.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  cancelarConta(
    @CorpoValidado(cancelamentoContaSchema) dados: CancelamentoContaInput,
  ): Promise<ContaCancelada> {
    return this.lgpd.cancelarConta(dados);
  }
}
