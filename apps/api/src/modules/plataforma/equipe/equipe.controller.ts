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
} from '@nestjs/common';
import {
  aceitarConviteSchema,
  atualizarFuncionarioSchema,
  conviteEquipeSchema,
  type AceitarConviteInput,
  type AtualizarFuncionarioInput,
  type ConviteEquipeInput,
  type EquipeResponse,
  type Funcionario,
  type SessaoResponse,
} from '@gestao/shared-types';
import { Permissoes } from '../../../common/decorators/permissoes.decorator';
import { Publico } from '../../../common/decorators/publico.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { EquipeService } from './equipe.service';

@Controller('equipe')
export class EquipeController {
  constructor(private readonly equipe: EquipeService) {}

  @Get()
  @Permissoes('equipe.gerenciar')
  listar(): Promise<EquipeResponse> {
    return this.equipe.listar();
  }

  @Post('convites')
  @Permissoes('equipe.gerenciar')
  @HttpCode(HttpStatus.NO_CONTENT)
  convidar(
    @Body(new ZodValidationPipe(conviteEquipeSchema)) dados: ConviteEquipeInput,
  ): Promise<void> {
    return this.equipe.convidar(dados);
  }

  @Patch('funcionarios/:id')
  @Permissoes('equipe.gerenciar')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(atualizarFuncionarioSchema)) dados: AtualizarFuncionarioInput,
  ): Promise<Funcionario> {
    return this.equipe.atualizar(id, dados);
  }

  @Delete('convites/:id')
  @Permissoes('equipe.gerenciar')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.equipe.cancelarConvite(id);
  }

  @Publico()
  @Post('convites/aceitar')
  aceitar(
    @Body(new ZodValidationPipe(aceitarConviteSchema)) dados: AceitarConviteInput,
  ): Promise<SessaoResponse> {
    return this.equipe.aceitar(dados);
  }
}
