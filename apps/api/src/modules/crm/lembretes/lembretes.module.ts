import { Module } from '@nestjs/common';
import { LembretesEnvioModule } from './envio/lembretes-envio.module';
import { LembretesController } from './lembretes.controller';
import { LembretesService } from './lembretes.service';

@Module({
  // O envio automático entra só quando há Redis configurado — ver
  // `LembretesEnvioModule`. Sem ele, sobra o CRUD, e os lembretes ficam
  // pendentes esperando a fila existir.
  imports: [LembretesEnvioModule.registrar()],
  controllers: [LembretesController],
  providers: [LembretesService],
})
export class LembretesModule {}
