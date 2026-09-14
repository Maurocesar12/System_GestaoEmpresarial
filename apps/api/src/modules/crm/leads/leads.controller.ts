import { Controller, Get } from '@nestjs/common';
import {
  leadsQuerySchema,
  reativacaoQuerySchema,
  type EntradaDeLeads,
  type LeadsQuery,
  type ListaDeReativacao,
  type ReativacaoQuery,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { QueryValidada } from '../../../common/decorators/validado.decorator';
import { LeadsService } from './leads.service';

/**
 * Entrada de leads e lista de reativação.
 *
 * As duas rotas são leitura sobre a carteira, então pedem a mesma permissão de
 * quem pode ver clientes. Não existe rota de escrita aqui de propósito: o que
 * se faz com um lead — registrar atendimento, emitir orçamento, marcar
 * follow-up — já tem dono em outro módulo, e duplicar essas ações aqui criaria
 * dois caminhos para a mesma gravação.
 */
@Controller('leads')
@Permissoes('clientes.visualizar')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  entrada(@QueryValidada(leadsQuerySchema) query: LeadsQuery): Promise<EntradaDeLeads> {
    return this.leads.entrada(query);
  }

  @Get('reativacao')
  reativacao(
    @QueryValidada(reativacaoQuerySchema) query: ReativacaoQuery,
  ): Promise<ListaDeReativacao> {
    return this.leads.reativacao(query);
  }
}
