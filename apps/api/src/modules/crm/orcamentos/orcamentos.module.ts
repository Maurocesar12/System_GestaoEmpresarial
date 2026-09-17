import { Module } from '@nestjs/common';
import { ComissoesModule } from '../../operacao/comissoes/comissoes.module';
import { FunilModule } from '../funil/funil.module';
import { OrcamentosController } from './orcamentos.controller';
import { OrcamentosService } from './orcamentos.service';

/**
 * `FunilModule` importado porque emitir e aprovar orçamento movem o cliente no
 * funil; `ComissoesModule`, porque aprovar gera a comissão do vendedor. As
 * dependências são de mão única, o que evita ciclo de importação.
 */
@Module({
  imports: [FunilModule, ComissoesModule],
  controllers: [OrcamentosController],
  providers: [OrcamentosService],
  exports: [OrcamentosService],
})
export class OrcamentosModule {}
