import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { cadastroSchema, type CadastroInput, type SessaoResponse } from '@gestao/shared-types';
import { Publico } from '../../common/decorators/publico.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LIMITE_CADASTRO } from '../auth/auth.rate-limit';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Publico()
  @Post('cadastro')
  @Throttle(LIMITE_CADASTRO)
  cadastrar(
    @Body(new ZodValidationPipe(cadastroSchema)) dados: CadastroInput,
  ): Promise<SessaoResponse> {
    return this.onboarding.cadastrar(dados);
  }
}
