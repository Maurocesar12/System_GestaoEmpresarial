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
  Put,
} from '@nestjs/common';
import {
  etapaFormSchema,
  moverClienteSchema,
  reordenarEtapasSchema,
  type EtapaFormInput,
  type EtapaFunil,
  type MoverClienteInput,
  type QuadroFunil,
  type ReordenarEtapasInput,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { FunilService } from './funil.service';

/**
 * Rotas do funil.
 *
 * Ver e movimentar é do time de CRM inteiro (§9.5). Mudar a **estrutura** do
 * funil — criar, renomear, reordenar, excluir etapas — é só de `admin`: são as
 * regras do processo comercial da empresa, e não algo para se alterar no meio
 * de um atendimento.
 */
@Controller('funil')
@Permissoes('funil.visualizar')
export class FunilController {
  constructor(private readonly funil: FunilService) {}

  @Get()
  quadro(): Promise<QuadroFunil> {
    return this.funil.montarQuadro();
  }

  @Get('etapas')
  listarEtapas(): Promise<EtapaFunil[]> {
    return this.funil.listarEtapas();
  }

  @Post('mover')
  @Permissoes('funil.movimentar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async mover(
    @Body(new ZodValidationPipe(moverClienteSchema)) dados: MoverClienteInput,
  ): Promise<void> {
    await this.funil.mover(dados);
  }

  @Delete('clientes/:clienteId')
  @Permissoes('funil.movimentar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerDoFunil(@Param('clienteId', ParseUUIDPipe) clienteId: string): Promise<void> {
    await this.funil.removerDoFunil(clienteId);
  }

  // --- Estrutura do funil: somente admin ------------------------------------

  @Post('etapas')
  @Permissoes('funil.configurar')
  criarEtapa(
    @Body(new ZodValidationPipe(etapaFormSchema)) dados: EtapaFormInput,
  ): Promise<EtapaFunil> {
    return this.funil.criarEtapa(dados);
  }

  @Patch('etapas/:id')
  @Permissoes('funil.configurar')
  renomearEtapa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(etapaFormSchema)) dados: EtapaFormInput,
  ): Promise<EtapaFunil> {
    return this.funil.renomearEtapa(id, dados);
  }

  @Put('etapas/ordem')
  @Permissoes('funil.configurar')
  reordenarEtapas(
    @Body(new ZodValidationPipe(reordenarEtapasSchema)) dados: ReordenarEtapasInput,
  ): Promise<EtapaFunil[]> {
    return this.funil.reordenarEtapas(dados);
  }

  @Delete('etapas/:id')
  @Permissoes('funil.configurar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerEtapa(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.funil.removerEtapa(id);
  }
}
