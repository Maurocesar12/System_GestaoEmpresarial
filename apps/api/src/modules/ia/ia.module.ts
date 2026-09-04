import { Module } from '@nestjs/common';
import { IaInfraModule } from '../../infra/ia/ia-infra.module';
import { IaController } from './ia.controller';
import { PrevisaoFinanceiraService } from './previsao-financeira.service';

@Module({
  imports: [IaInfraModule],
  controllers: [IaController],
  providers: [PrevisaoFinanceiraService],
})
export class IaModule {}
