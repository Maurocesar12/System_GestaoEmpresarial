import { Module } from '@nestjs/common';
import { LancamentosController } from './lancamentos.controller';
import { LancamentosService } from './lancamentos.service';

@Module({
  controllers: [LancamentosController],
  providers: [LancamentosService],
  exports: [LancamentosService],
})
export class FinanceiroModule {}
