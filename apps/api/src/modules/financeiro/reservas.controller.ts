import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  movimentacaoFormSchema,
  reservaFormSchema,
  type MovimentacaoFormInput,
  type Reserva,
  type ReservaFormInput,
  type ResumoReservas,
} from '@gestao/shared-types';
import { Permissoes } from '../../common/decorators/permissoes.decorator';
import { CorpoValidado } from '../../common/decorators/validado.decorator';
import { ReservasService } from './reservas.service';

@Controller('financeiro/reservas')
@Permissoes('financeiro.visualizar')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  /** Devolve o resumo, e não uma lista crua: o saldo só significa algo ao lado do custo fixo. */
  @Get()
  resumir(): Promise<ResumoReservas> {
    return this.reservas.resumir();
  }

  @Post()
  @Permissoes('financeiro.criar')
  criar(@CorpoValidado(reservaFormSchema) dados: ReservaFormInput): Promise<Reserva> {
    return this.reservas.criar(dados);
  }

  @Patch(':id')
  @Permissoes('financeiro.editar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(reservaFormSchema) dados: ReservaFormInput,
  ): Promise<Reserva> {
    return this.reservas.atualizar(id, dados);
  }

  /**
   * Guardar ou resgatar.
   *
   * `POST` numa sub-rota, e não `PATCH` no saldo, porque é uma ação de negócio
   * com regra própria — recusa resgate maior que o guardado — e não a edição de
   * um campo.
   */
  @Post(':id/movimentar')
  @Permissoes('financeiro.editar')
  movimentar(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(movimentacaoFormSchema) dados: MovimentacaoFormInput,
  ): Promise<Reserva> {
    return this.reservas.movimentar(id, dados);
  }

  @Delete(':id')
  @Permissoes('financeiro.excluir')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.reservas.remover(id);
  }
}
