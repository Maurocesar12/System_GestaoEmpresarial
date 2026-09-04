import { Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  gerarPrevisaoFinanceiraSchema,
  type ConsumoIaResponse,
  type GerarPrevisaoFinanceiraInput,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import { Permissoes } from '../../common/decorators/permissoes.decorator';
import { CorpoValidado } from '../../common/decorators/validado.decorator';
import { PrevisaoFinanceiraService } from './previsao-financeira.service';

@Controller('ia')
export class IaController {
  constructor(private readonly previsao: PrevisaoFinanceiraService) {}

  @Get('consumo')
  @Permissoes('ia.visualizar_consumo')
  consumo(): Promise<ConsumoIaResponse> {
    return this.previsao.consumoDoMes();
  }

  @Get('previsao-financeira/ultima')
  @Permissoes('ia.previsao_financeira')
  ultima(): Promise<PrevisaoFinanceiraResponse | null> {
    return this.previsao.ultima();
  }

  @Post('previsao-financeira')
  @Permissoes('ia.previsao_financeira')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  gerar(
    @CorpoValidado(gerarPrevisaoFinanceiraSchema) dados: GerarPrevisaoFinanceiraInput,
  ): Promise<PrevisaoFinanceiraResponse> {
    return this.previsao.gerar(dados);
  }
}
