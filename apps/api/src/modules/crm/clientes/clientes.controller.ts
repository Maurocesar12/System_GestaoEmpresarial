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
  conferenciaImportacaoClientesSchema,
  importacaoClientesSchema,
  type Cliente,
  type ClienteFormInput,
  type ClientesQuery,
  type ConferenciaImportacaoClientes,
  type ConferenciaImportacaoClientesInput,
  type ImportacaoClientesInput,
  type Paginado,
  type ResultadoImportacao,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ClientesService } from './clientes.service';
import { conferirLinhasDeClientes } from './conferencia-importacao';

/**
 * Rotas de clientes.
 *
 * A leitura é a permissão padrão do controller; criar, editar, importar e
 * excluir sobrescrevem essa regra com a ação específica. Assim um funcionário
 * pode consultar clientes sem ganhar, por acidente, o direito de apagá-los.
 */
@Controller('clientes')
@Permissoes('clientes.visualizar')
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
  @Permissoes('clientes.criar')
  criar(@Body(new ZodValidationPipe(clienteFormSchema)) dados: ClienteFormInput): Promise<Cliente> {
    return this.clientes.criar(dados);
  }

  /**
   * Importa um lote vindo de planilha.
   *
   * Recebe JSON, e não o arquivo: quem lê a planilha é o navegador, o que
   * poupa a API de lidar com upload, formato de arquivo e memória de arquivo
   * grande. Ler não é validar — a validação é desta API, aqui e em
   * `importar/conferir`.
   *
   * Restrito a `admin`: importar mil clientes de uma vez tem peso diferente de
   * cadastrar um.
   */
  /**
   * Confere a planilha sem gravar nada: a prévia "válida / com erro" da tela.
   *
   * Recebe as linhas cruas, como saíram do arquivo. A tela não valida nada —
   * só mostra o que esta rota devolve, e depois manda para `importar` os
   * `dados` das linhas válidas.
   */
  @Post('importar/conferir')
  @Permissoes('clientes.importar')
  @HttpCode(HttpStatus.OK)
  conferirImportacao(
    @Body(new ZodValidationPipe(conferenciaImportacaoClientesSchema))
    dados: ConferenciaImportacaoClientesInput,
  ): ConferenciaImportacaoClientes {
    return { linhas: conferirLinhasDeClientes(dados.clientes) };
  }

  @Post('importar')
  @Permissoes('clientes.importar')
  importar(
    @Body(new ZodValidationPipe(importacaoClientesSchema)) dados: ImportacaoClientesInput,
  ): Promise<ResultadoImportacao> {
    return this.clientes.importar(dados.clientes);
  }

  @Patch(':id')
  @Permissoes('clientes.editar')
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
  @Permissoes('clientes.excluir')
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.clientes.remover(id);
  }
}
