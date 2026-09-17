import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
  ajusteEstoqueSchema,
  entradaEstoqueSchema,
  fichaTecnicaSchema,
  materialFormSchema,
  materiaisQuerySchema,
  type AjusteEstoqueInput,
  type EntradaEstoqueInput,
  type FichaTecnica,
  type FichaTecnicaInput,
  type Material,
  type MaterialDetalhe,
  type MaterialFormInput,
  type MateriaisQuery,
  type Paginado,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { CorpoValidado, QueryValidada } from '../../../common/decorators/validado.decorator';
import { EstoqueService } from './estoque.service';

@Controller()
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get('estoque/materiais')
  @Permissoes('estoque.visualizar')
  listar(@QueryValidada(materiaisQuerySchema) query: MateriaisQuery): Promise<Paginado<Material>> {
    return this.estoque.listar(query);
  }

  @Get('estoque/materiais/:id')
  @Permissoes('estoque.visualizar')
  buscar(@Param('id', ParseUUIDPipe) id: string): Promise<MaterialDetalhe> {
    return this.estoque.buscar(id);
  }

  @Post('estoque/materiais')
  @Permissoes('estoque.gerenciar')
  criar(@CorpoValidado(materialFormSchema) dados: MaterialFormInput): Promise<Material> {
    return this.estoque.criar(dados);
  }

  @Patch('estoque/materiais/:id')
  @Permissoes('estoque.gerenciar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(materialFormSchema) dados: MaterialFormInput,
  ): Promise<Material> {
    return this.estoque.atualizar(id, dados);
  }

  @Post('estoque/materiais/:id/entradas')
  @Permissoes('estoque.gerenciar')
  registrarEntrada(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(entradaEstoqueSchema) dados: EntradaEstoqueInput,
  ): Promise<Material> {
    return this.estoque.registrarEntrada(id, dados);
  }

  @Post('estoque/materiais/:id/ajustes')
  @Permissoes('estoque.gerenciar')
  registrarAjuste(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(ajusteEstoqueSchema) dados: AjusteEstoqueInput,
  ): Promise<Material> {
    return this.estoque.registrarAjuste(id, dados);
  }

  // A lista de materiais faz parte do cadastro do serviço: quem pode alterar o
  // custo base do serviço pode alterar o que ele consome.
  @Get('servicos/:id/materiais')
  @Permissoes('servicos.visualizar')
  fichaTecnica(@Param('id', ParseUUIDPipe) id: string): Promise<FichaTecnica> {
    return this.estoque.fichaTecnica(id);
  }

  @Put('servicos/:id/materiais')
  @Permissoes('servicos.gerenciar')
  salvarFichaTecnica(
    @Param('id', ParseUUIDPipe) id: string,
    @CorpoValidado(fichaTecnicaSchema) dados: FichaTecnicaInput,
  ): Promise<FichaTecnica> {
    return this.estoque.salvarFichaTecnica(id, dados);
  }
}
