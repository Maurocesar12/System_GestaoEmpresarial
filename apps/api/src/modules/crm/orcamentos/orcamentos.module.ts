import { Module } from '@nestjs/common';
import { FunilModule } from '../funil/funil.module';
import { OrcamentosController } from './orcamentos.controller';
import { OrcamentosService } from './orcamentos.service';

/**
 * `FunilModule` importado porque emitir e aprovar orçamento movem o cliente no
 * funil. A dependência é de mão única — o funil não conhece orçamentos —, o que
 * evita o ciclo de importação que dois módulos se referenciando criariam.
 */
@Module({
  imports: [FunilModule],
  controllers: [OrcamentosController],
  providers: [OrcamentosService],
  exports: [OrcamentosService],
})
export class OrcamentosModule {}
