import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './infra/prisma/prisma.service';

/**
 * Teste de inicialização da aplicação.
 *
 * Existe por causa de um bug que passou por todos os outros testes: o
 * `PrismaService` recebia a URL do banco como parâmetro comum do construtor, e
 * o NestJS não sabia o que injetar ali. A classe funcionava perfeitamente
 * quando instanciada à mão — que é como os testes de isolamento a usam —, mas a
 * API inteira se recusava a subir.
 *
 * A lição é que testar as peças isoladamente não prova que elas se encaixam.
 * Este teste monta o container de injeção de dependência de verdade, do mesmo
 * jeito que `main.ts` faz.
 *
 * Nota: `describe` e `it` aqui são os globais do Jest. Se o editor sugerir
 * importá-los de `node:test`, recuse — é outro test runner, e a suíte quebra.
 */
describe('inicialização da aplicação', () => {
  it('monta o módulo raiz e resolve todas as dependências', async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await modulo.init();

    // Se o container conseguiu construir e entregar o serviço com seus métodos,
    // a injeção está certa. A verificação não usa `toBeInstanceOf` porque o
    // PrismaService estende uma classe que o Prisma 7 gera em tempo de execução,
    // e a comparação de identidade de classe não é confiável nesse caso.
    const prisma = modulo.get(PrismaService);

    expect(typeof prisma.comTenant).toBe('function');

    await modulo.close();
  });
});
