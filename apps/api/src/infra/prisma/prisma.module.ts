import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { PrismaService, URL_DO_BANCO } from './prisma.service';

/**
 * Acesso ao banco.
 *
 * `@Global` porque praticamente todo módulo de negócio precisa do
 * `PrismaService`; sem isso, cada um teria de importar o PrismaModule
 * explicitamente, sem ganho nenhum em troca.
 */
@Global()
@Module({
  providers: [
    {
      // A URL vem do ConfigService, e não de `process.env` lido dentro do
      // serviço: assim ela passa pela validação de ambiente da subida, e um
      // teste pode trocá-la sem mexer em variável global do processo.
      provide: URL_DO_BANCO,
      inject: [ConfigService],
      // O tipo de retorno é anotado porque `config.get` com `infer` devolve
      // `any` para o ESLint, e um `any` escapando daqui contaminaria o tipo da
      // URL no serviço.
      useFactory: (config: ConfigService<Env, true>): string =>
        config.get('DATABASE_URL', { infer: true }),
    },
    PrismaService,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
