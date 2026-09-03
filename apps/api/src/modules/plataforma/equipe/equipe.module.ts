import { Module } from '@nestjs/common';
import { NotificacoesModule } from '../../../infra/notificacoes/notificacoes.module';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';

@Module({
  imports: [NotificacoesModule],
  controllers: [EquipeController],
  providers: [EquipeService],
})
export class EquipeModule {}
