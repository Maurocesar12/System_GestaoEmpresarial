import { Module } from '@nestjs/common';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';
import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './pro-labore.service';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

/**
 * Financeiro.
 *
 * Pró-labore e reserva dependem do `FinanceiroService` para as somas do
 * período: as duas perguntam "qual é o custo fixo mensal", que o fluxo de caixa
 * já responde. Recalcular por fora abriria a porta para dois números diferentes
 * para a mesma coisa em telas diferentes.
 */
@Module({
  controllers: [FinanceiroController, ProLaboreController, ReservasController],
  providers: [FinanceiroService, ProLaboreService, ReservasService],
  exports: [FinanceiroService],
})
export class FinanceiroModule {}
