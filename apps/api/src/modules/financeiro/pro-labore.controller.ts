import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  proLaboreFormSchema,
  sugestaoQuerySchema,
  type ProLabore,
  type ProLaboreFormInput,
  type SugestaoProLabore,
  type SugestaoQuery,
} from '@gestao/shared-types';
import { Papeis } from '../../common/decorators/papeis.decorator';
import { CorpoValidado, QueryValidada } from '../../common/decorators/validado.decorator';
import { ProLaboreService } from './pro-labore.service';

/**
 * Pró-labore.
 *
 * Restrito a `admin` e `financeiro` como o resto do módulo (§9.5): a retirada
 * do dono é justamente o número que ele não quer expor ao dar acesso ao
 * sistema.
 */
@Controller('financeiro/pro-labore')
@Papeis('admin', 'financeiro')
export class ProLaboreController {
  constructor(private readonly proLabore: ProLaboreService) {}

  @Get()
  listar(): Promise<ProLabore[]> {
    return this.proLabore.listar();
  }

  /**
   * Declarado antes de qualquer rota com `:id`: na ordem inversa, "sugestao"
   * seria lido como um id e o `ParseUUIDPipe` recusaria a requisição.
   */
  @Get('sugestao')
  sugerir(@QueryValidada(sugestaoQuerySchema) query: SugestaoQuery): Promise<SugestaoProLabore> {
    return this.proLabore.sugerir(query.meses);
  }

  @Get('vigente')
  vigente(): Promise<ProLabore | null> {
    return this.proLabore.vigente();
  }

  @Post()
  definir(@CorpoValidado(proLaboreFormSchema) dados: ProLaboreFormInput): Promise<ProLabore> {
    return this.proLabore.definir(dados);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.proLabore.remover(id);
  }
}
