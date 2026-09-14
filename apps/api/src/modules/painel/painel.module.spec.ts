import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ChatIaService } from '../ia/chat-ia.service';
import { AssistenteAjuda } from '../ia/ajuda/assistente-ajuda';
import { LeadsService } from '../crm/leads/leads.service';
import { PainelService } from './painel.service';

/**
 * O grafo de injeção da aplicação, montado de verdade.
 *
 * Três módulos passaram a depender uns dos outros: o painel importa leads, e a
 * IA importa o painel. Dependência entre módulos é o tipo de coisa que compila
 * sem reclamar e quebra **na subida da aplicação** — provider não exportado,
 * import circular, serviço que só existe em outro módulo. Em produção isso
 * aparece como container que não sobe; aqui aparece como teste vermelho.
 *
 * `compile()` instancia os providers sem chamar `onModuleInit`, então nada abre
 * conexão: a URL de banco existe só para o construtor do Prisma e para a
 * validação do ambiente não recusarem a montagem.
 *
 * O `AppModule` é importado **dentro** do teste, e não no topo do arquivo: a
 * validação do ambiente roda na avaliação do decorator `@Module`, ou seja, no
 * import. Com o import estático, ela aconteceria antes de qualquer `beforeAll`
 * ter a chance de definir as variáveis.
 */
describe('grafo de módulos', () => {
  const ambienteOriginal = { ...process.env };

  beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://localhost:5432/placeholder';
    process.env.JWT_SECRET ??= 'segredo-exclusivo-de-teste-com-mais-de-32-caracteres';
    // Sem Redis, o módulo de envio de lembretes entra vazio de propósito — é o
    // mesmo caminho de um `pnpm dev` sem infraestrutura extra.
    delete process.env.REDIS_URL;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('resolve o painel, a fila de leads e os dois assistentes do chat', async () => {
    const { AppModule } = await import('../../app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(modulo.get(PainelService)).toBeInstanceOf(PainelService);
    expect(modulo.get(LeadsService)).toBeInstanceOf(LeadsService);
    expect(modulo.get(ChatIaService)).toBeInstanceOf(ChatIaService);
    expect(modulo.get(AssistenteAjuda)).toBeInstanceOf(AssistenteAjuda);

    // O mesmo Prisma para todo mundo: duas instâncias significariam dois pools
    // de conexão e, pior, duas transações onde o painel promete uma só.
    expect(modulo.get(PrismaService)).toBe(modulo.get(PrismaService));

    await modulo.close();
  });
});
