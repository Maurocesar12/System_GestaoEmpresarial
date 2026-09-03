import { Module } from '@nestjs/common';
import { NotificacoesModule } from '../../../infra/notificacoes/notificacoes.module';
import { ConfiguracoesController } from './configuracoes.controller';
import { ConfiguracoesService } from './configuracoes.service';
@Module({
  imports: [NotificacoesModule],
  controllers: [ConfiguracoesController],
  providers: [ConfiguracoesService],
})
export class ConfiguracoesModule {}
