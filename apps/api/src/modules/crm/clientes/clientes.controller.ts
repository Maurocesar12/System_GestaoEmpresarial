import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  clienteFormSchema,
  clientesQuerySchema,
  type Cliente,
  type ClienteFormInput,
  type ClientesQuery,
  type Paginado,
} from '@gestao/shared-types';
import { Papeis } from '../../../common/decorators/papeis.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ClientesService } from './clientes.service';

/**
 * Rotas de clientes.
 *
 * `@Papeis` no controller inteiro, conforme §9.5: CRM é acessível a `admin`,
 * `atendente` e `tecnico`. Quem tem papel `financeiro` não entra aqui — a
 * separação existe para que a pessoa que cuida do caixa não tenha acesso à
 * carteira de clientes sem necessidade.
 */
@Controller('clientes')
@Papeis('admin', 'atendente', 'tecnico')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  listar(
    // `clientesQuerySchema` — o schema da query string, com paginação e busca.
    // Não confundir com `clienteFormSchema`, que valida o corpo do cadastro:
    // usá-lo aqui exigiria um campo `nome` na URL e quebraria a listagem.
    @Query(new ZodValidationPipe(clientesQuerySchema)) query: ClientesQuery,
  ): Promise<Paginado<Cliente>> {
    return this.clientes.listar(query);
  }

  @Get(':id')
  // `ParseUUIDPipe` recusa um id malformado antes de chegar ao banco: sem ele,
  // um texto qualquer viraria erro de conversão do Postgres em vez de 400.
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<Cliente> {
    return this.clientes.buscarPorId(id);
  }

  @Post()
  criar(@Body(new ZodValidationPipe(clienteFormSchema)) dados: ClienteFormInput): Promise<Cliente> {
    return this.clientes.criar(dados);
  }

  @Patch(':id')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(clienteFormSchema)) dados: ClienteFormInput,
  ): Promise<Cliente> {
    return this.clientes.atualizar(id, dados);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Excluir cliente é restrito a `admin`: apaga em cascata o histórico de
  // atendimentos, orçamentos e agendamentos junto.
  @Papeis('admin')
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.clientes.remover(id);
  }
}
