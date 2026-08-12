import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Acesso ao banco.
 *
 * `@Global` porque praticamente todo módulo de negócio precisa do
 * `PrismaService`; sem isso, cada um teria de importar o PrismaModule
 * explicitamente, sem ganho nenhum em troca.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
