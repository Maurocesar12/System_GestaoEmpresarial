import { Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  chatIaSchema,
  gerarPrevisaoFinanceiraSchema,
  type ChatIaInput,
  type ChatIaResponse,
  type ConsumoIaResponse,
  type GerarPrevisaoFinanceiraInput,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import { Permissoes } from '../../common/decorators/permissoes.decorator';
import { CorpoValidado } from '../../common/decorators/validado.decorator';
import { ChatIaService } from './chat-ia.service';
import { PrevisaoFinanceiraService } from './previsao-financeira.service';

@Controller('ia')
export class IaController {
  constructor(
    private readonly previsao: PrevisaoFinanceiraService,
    private readonly chat: ChatIaService,
  ) {}

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

  @Post('chat')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  responderChat(@CorpoValidado(chatIaSchema) dados: ChatIaInput): Promise<ChatIaResponse> {
    return this.chat.responder(dados);
  }
}
