import { Module } from '@nestjs/common';
import { IaInfraModule } from '../../infra/ia/ia-infra.module';
import { ChatIaService } from './chat-ia.service';
import { IaController } from './ia.controller';
import { PrevisaoFinanceiraService } from './previsao-financeira.service';

@Module({
  imports: [IaInfraModule],
  controllers: [IaController],
  providers: [ChatIaService, PrevisaoFinanceiraService],
})
export class IaModule {}
