import { Module } from '@nestjs/common';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';
import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './pro-labore.service';
import { RecorrenciaAgendador } from './recorrencia.agendador';
import { RecorrenciaController } from './recorrencia.controller';
import { RecorrenciaService } from './recorrencia.service';
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
  controllers: [
    FinanceiroController,
    ProLaboreController,
    RecorrenciaController,
    ReservasController,
  ],
  providers: [
    FinanceiroService,
    ProLaboreService,
    RecorrenciaService,
    // O agendador não é rota: ele acorda de madrugada e transforma os moldes de
    // recorrência em lançamentos. Fica aqui porque é do financeiro que ele
    // escreve.
    RecorrenciaAgendador,
    ReservasService,
  ],
  exports: [FinanceiroService],
})
export class FinanceiroModule {}
