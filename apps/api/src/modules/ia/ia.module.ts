import { Module } from '@nestjs/common';
import { IaInfraModule } from '../../infra/ia/ia-infra.module';
import { PainelModule } from '../painel/painel.module';
import { AssistenteAjuda } from './ajuda/assistente-ajuda';
import { ChatIaService } from './chat-ia.service';
import { IaController } from './ia.controller';
import { PrevisaoFinanceiraService } from './previsao-financeira.service';

/**
 * `PainelModule` importado porque o chat com IA conversa sobre exatamente o que
 * o painel mostra — mesma leitura, mesmas permissões, mesmo instante. Sem isso
 * existiriam duas coletas concorrentes da mesma verdade, e o assistente acabaria
 * contradizendo a tela aberta ao lado.
 */
@Module({
  imports: [IaInfraModule, PainelModule],
  controllers: [IaController],
  providers: [AssistenteAjuda, ChatIaService, PrevisaoFinanceiraService],
})
export class IaModule {}
