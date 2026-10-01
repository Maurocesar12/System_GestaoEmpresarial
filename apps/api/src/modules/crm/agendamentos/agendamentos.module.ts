import { Module } from '@nestjs/common';
import { FinanceiroModule } from '../../financeiro/financeiro.module';
import { ComissoesModule } from '../../operacao/comissoes/comissoes.module';
import { EstoqueModule } from '../../operacao/estoque/estoque.module';
import { AgendamentosController } from './agendamentos.controller';
import { AgendamentosService } from './agendamentos.service';

/** Estoque e comissões entram porque a execução baixa materiais e gera comissão. */
@Module({
  imports: [EstoqueModule, ComissoesModule, FinanceiroModule],
  controllers: [AgendamentosController],
  providers: [AgendamentosService],
  exports: [AgendamentosService],
})
export class AgendamentosModule {}
