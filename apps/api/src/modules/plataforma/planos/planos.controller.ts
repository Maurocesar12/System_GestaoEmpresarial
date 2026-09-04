import { Controller, Get } from '@nestjs/common';
import type { PlanoAtualResponse } from '@gestao/shared-types';
import { PlanosService } from './planos.service';

@Controller('planos')
export class PlanosController {
  constructor(private readonly planos: PlanosService) {}

  @Get('atual')
  atual(): Promise<PlanoAtualResponse> {
    return this.planos.atual();
  }
}
