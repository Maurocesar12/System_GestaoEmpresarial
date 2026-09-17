import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  comissoesQuerySchema,
  fechamentoComissaoSchema,
  minhasComissoesQuerySchema,
  type ComissoesQuery,
  type FechamentoComissao,
  type FechamentoComissaoInput,
  type MinhasComissoesQuery,
  type RelatorioComissoes,
} from '@gestao/shared-types';
import { Papeis } from '../../../common/decorators/papeis.decorator';
import { CorpoValidado, QueryValidada } from '../../../common/decorators/validado.decorator';
import { ComissoesService } from './comissoes.service';

/**
 * Comissões da equipe inteira.
 *
 * Papel, e não permissão: quanto cada um ganha e o fechamento que vira conta a
 * pagar ficam com o dono, sem opção de conceder a funcionário na tela de equipe.
 */
@Controller('comissoes')
@Papeis('admin')
export class ComissoesController {
  constructor(private readonly comissoes: ComissoesService) {}

  @Get()
  listar(@QueryValidada(comissoesQuerySchema) query: ComissoesQuery): Promise<RelatorioComissoes> {
    return this.comissoes.listar(query);
  }

  @Post('fechar')
  @HttpCode(HttpStatus.OK)
  fechar(
    @CorpoValidado(fechamentoComissaoSchema) dados: FechamentoComissaoInput,
  ): Promise<FechamentoComissao> {
    return this.comissoes.fechar(dados);
  }
}

/** As comissões de quem está logado. Aberto a qualquer pessoa da equipe. */
@Controller('comissoes/minhas')
export class MinhasComissoesController {
  constructor(private readonly comissoes: ComissoesService) {}

  @Get()
  listar(
    @QueryValidada(minhasComissoesQuerySchema) query: MinhasComissoesQuery,
  ): Promise<RelatorioComissoes> {
    return this.comissoes.listarMinhas(query);
  }
}
