import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

/**
 * Exporta o serviço porque o painel em tempo real reaproveita as duas leituras
 * — entrada e reativação — em vez de reescrever as mesmas regras de corte.
 */
@Module({
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
