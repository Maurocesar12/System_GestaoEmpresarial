import { Module } from '@nestjs/common';
import { LeadsModule } from '../crm/leads/leads.module';
import { PainelController } from './painel.controller';
import { PainelService } from './painel.service';

/**
 * `LeadsModule` importado porque o painel mostra a mesma fila de entrada e a
 * mesma fila de reativação das telas dedicadas. Reaproveitar o serviço é o que
 * impede o painel de dizer um número e a tela mostrar outro.
 */
@Module({
  imports: [LeadsModule],
  controllers: [PainelController],
  providers: [PainelService],
  // Exportado para o chat com IA: ele responde sobre o mesmo panorama que o
  // painel desenha, em vez de montar uma segunda coleta dos mesmos números.
  exports: [PainelService],
})
export class PainelModule {}
