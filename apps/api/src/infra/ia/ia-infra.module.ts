import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { AssistenteDemonstracao } from './assistente-demonstracao';
import { AssistenteIa } from './assistente-ia';
import { AssistenteOpenAI } from './assistente-openai';

@Module({
  providers: [
    {
      provide: AssistenteIa,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): AssistenteIa => {
        const chave = config.get('OPENAI_API_KEY', { infer: true });
        if (!chave) {
          new Logger('IaInfraModule').warn(
            'OPENAI_API_KEY não configurada — previsões usarão o modo de demonstração.',
          );
          return new AssistenteDemonstracao();
        }
        return new AssistenteOpenAI(
          chave,
          config.get('OPENAI_MODEL', { infer: true }),
          config.get('OPENAI_BASE_URL', { infer: true }),
        );
      },
    },
  ],
  exports: [AssistenteIa],
})
export class IaInfraModule {}
