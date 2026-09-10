import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { PlanoAtualResponse, PlanosCatalogoResponse } from '@gestao/shared-types';
import { PlanosService } from './planos.service';

@Controller('planos')
export class PlanosController {
  constructor(private readonly planos: PlanosService) {}

  @Get('atual')
  atual(): Promise<PlanoAtualResponse> {
    return this.planos.atual();
  }

  @Get('catalogo')
  catalogo(): Promise<PlanosCatalogoResponse> {
    return this.planos.catalogo();
  }

  @Post('verificar')
  @HttpCode(HttpStatus.OK)
  verificar(): Promise<PlanosCatalogoResponse> {
    return this.planos.catalogo();
  }
}
