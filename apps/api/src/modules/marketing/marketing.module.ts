import { Module } from '@nestjs/common';
import { ClientesModule } from '../crm/clientes/clientes.module';
import { FormularioPublicoController, MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

/**
 * Marketing — beta (arquitetura §8.3).
 *
 * Importa `ClientesModule` porque o lead do formulário é um cliente como
 * qualquer outro: o limite do plano, a entrada no funil e a auditoria são as
 * regras de lá, e reimplementá-las aqui seria abrir caminho para divergirem.
 * A dependência é de mão única — clientes não conhece marketing.
 */
@Module({
  imports: [ClientesModule],
  controllers: [MarketingController, FormularioPublicoController],
  providers: [MarketingService],
})
export class MarketingModule {}
