import { Module } from '@nestjs/common';
import { ComissoesController, MinhasComissoesController } from './comissoes.controller';
import { ComissoesService } from './comissoes.service';

/** Exporta o serviço para orçamentos e agendamentos gerarem comissão nas transições. */
@Module({
  controllers: [ComissoesController, MinhasComissoesController],
  providers: [ComissoesService],
  exports: [ComissoesService],
})
export class ComissoesModule {}
