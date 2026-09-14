import { Controller, Get } from '@nestjs/common';
import type { PainelTempoReal } from '@gestao/shared-types';
import { PainelService } from './painel.service';

/**
 * Painel inicial.
 *
 * Sem `@Permissoes`: toda pessoa autenticada tem uma tela inicial. O que muda
 * de um papel para outro é **o conteúdo** — o serviço só consulta os blocos que
 * a permissão permite, e devolve `null` nos demais.
 */
@Controller('painel')
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get('tempo-real')
  tempoReal(): Promise<PainelTempoReal> {
    return this.painel.tempoReal();
  }
}
