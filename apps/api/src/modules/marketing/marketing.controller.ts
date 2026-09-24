import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  leadPublicoSchema,
  marketingQuerySchema,
  type ChaveMarketing,
  type LeadPublicoInput,
  type LeadPublicoResposta,
  type MarketingQuery,
  type RelatorioMarketing,
} from '@gestao/shared-types';
import { CorpoValidado, QueryValidada } from '../../common/decorators/validado.decorator';
import { Permissoes } from '../../common/decorators/permissoes.decorator';
import { Publico } from '../../common/decorators/publico.decorator';
import { MarketingService } from './marketing.service';

/**
 * Limite do formulário público, por endereço IP.
 *
 * Cinco por minuto é folgado para uma pessoa que errou algo e reenviou, e
 * apertado para quem automatiza. Lido de `process.env` direto porque o
 * decorator `@Throttle` é avaliado na carga do módulo, antes de o
 * ConfigService existir — mesma razão de `auth.rate-limit.ts`.
 *
 * O limite por IP não é a única defesa, e nem a principal: ele segura volume,
 * enquanto a chave por empresa e o campo-armadilha cuidam de quem tem intenção.
 */
const LIMITE_FORMULARIO = {
  default: {
    limit: Number(process.env['MARKETING_LIMITE_FORMULARIO']) || 5,
    ttl: 60_000,
  },
};

/** Relatórios e a chave do formulário. Só para quem está dentro do sistema. */
@Controller('marketing')
@Permissoes('marketing.visualizar')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('relatorio')
  relatorio(
    @QueryValidada(marketingQuerySchema) query: MarketingQuery,
  ): Promise<RelatorioMarketing> {
    return this.marketing.relatorio(query);
  }

  @Get('chave')
  chave(): Promise<ChaveMarketing> {
    return this.marketing.chave();
  }

  /** Gerar de novo invalida a anterior — é também o botão de revogar. */
  @Post('chave')
  @Permissoes('marketing.gerenciar')
  gerarChave(): Promise<ChaveMarketing> {
    return this.marketing.gerarChave();
  }
}

/**
 * O formulário embedável do site do assinante (arquitetura §8.3).
 *
 * Único endpoint do sistema que **grava** sem autenticação, e por isso o
 * desenho é defensivo em camadas: chave por empresa no corpo, limite por IP,
 * campo-armadilha, consentimento obrigatório e uma resposta que não varia.
 *
 * Fica num controller próprio, fora de `/marketing`, para que o `@Publico()`
 * não conviva com as rotas autenticadas: o guard global é o que mantém tudo
 * fechado por padrão, e misturar os dois num arquivo é como um decorator
 * esquecido no lugar errado vira rota aberta sem ninguém notar.
 */
@Controller('publico')
export class FormularioPublicoController {
  constructor(private readonly marketing: MarketingService) {}

  @Publico()
  @Throttle(LIMITE_FORMULARIO)
  @Post('leads')
  @HttpCode(HttpStatus.OK)
  async receber(
    @CorpoValidado(leadPublicoSchema) dados: LeadPublicoInput,
  ): Promise<LeadPublicoResposta> {
    await this.marketing.receberLead(dados);

    // Sempre a mesma resposta, tenha o lead sido gravado ou descartado. Ver
    // `MarketingService.receberLead`.
    return { recebido: true };
  }
}
