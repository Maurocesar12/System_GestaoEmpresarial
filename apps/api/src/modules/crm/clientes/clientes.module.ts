import { Module } from '@nestjs/common';
import { FunilModule } from '../funil/funil.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

/**
 * `FunilModule` importado porque todo cliente novo entra no funil. A dependência
 * é de mão única — o funil não conhece o módulo de clientes —, o que evita o
 * ciclo de importação que dois módulos se referenciando criariam.
 */
@Module({
  imports: [FunilModule],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
