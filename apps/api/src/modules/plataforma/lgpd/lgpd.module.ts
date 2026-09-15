import { Module } from '@nestjs/common';
import { ExclusaoContasAgendador } from './exclusao-contas.agendador';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';

@Module({
  controllers: [LgpdController],
  providers: [LgpdService, ExclusaoContasAgendador],
})
export class LgpdModule {}
