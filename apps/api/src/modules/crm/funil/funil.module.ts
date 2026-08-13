import { Module } from '@nestjs/common';
import { FunilController } from './funil.controller';
import { FunilService } from './funil.service';

@Module({
  controllers: [FunilController],
  providers: [FunilService],
  exports: [FunilService],
})
export class FunilModule {}
