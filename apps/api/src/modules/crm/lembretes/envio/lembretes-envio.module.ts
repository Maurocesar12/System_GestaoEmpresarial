import { BullModule } from '@nestjs/bullmq';
import { Logger, Module, type DynamicModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificacoesModule } from '../../../../infra/notificacoes/notificacoes.module';
import { FILA_LEMBRETES } from './envio.constantes';
import { LembretesAgendador } from './lembretes.agendador';
import { LembretesProcessor } from './lembretes.processor';

/**
 * Envio automático de lembretes: varredura, fila e worker.
 *
 * O módulo é *dinâmico* porque o envio automático depende de Redis, e Redis é
 * opcional neste projeto (ver o checklist de produção no README). Sem
 * `REDIS_URL`, o módulo entra vazio: a API sobe normalmente, o CRUD de
 * lembretes continua funcionando e os lembretes ficam `pendente` — que é
 * exatamente o comportamento que existia antes desta fatia.
 *
 * A alternativa seria registrar a fila sempre e deixar a aplicação quebrar na
 * subida em qualquer máquina sem Redis. Para um projeto onde `pnpm dev` precisa
 * funcionar sem infraestrutura extra, essa troca não compensa.
 */
@Module({})
export class LembretesEnvioModule {
  static registrar(): DynamicModule {
    // Lido direto de `process.env`, e não do ConfigService: a composição dos
    // módulos acontece antes de existir injeção de dependência. O valor é o
    // mesmo que o `envSchema` valida na subida.
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      new Logger(LembretesEnvioModule.name).warn(
        'REDIS_URL não configurada — o envio automático de lembretes está desligado. ' +
          'Os lembretes continuam sendo criados e ficam pendentes.',
      );

      return { module: LembretesEnvioModule };
    }

    return {
      module: LembretesEnvioModule,
      imports: [
        // Liga o suporte a `@Cron`. Fica aqui, e não no AppModule, porque o
        // agendador de lembretes é hoje a única tarefa periódica do sistema —
        // quando surgir a segunda, isto sobe para a raiz.
        ScheduleModule.forRoot(),
        BullModule.forRoot({ connection: { url: redisUrl } }),
        BullModule.registerQueue({
          name: FILA_LEMBRETES,
          defaultJobOptions: {
            // Três tentativas com espera crescente (1min, 2min, 4min), para
            // absorver indisponibilidade curta do servidor de e-mail sem
            // martelá-lo de segundo em segundo.
            attempts: 3,
            backoff: { type: 'exponential', delay: 60_000 },

            // A fila não é histórico: o que aconteceu com cada lembrete fica no
            // banco, nas colunas `status`, `enviado_em` e `erro`. Limpar o job
            // também libera o `jobId` (que é o id do lembrete), permitindo que
            // a varredura reenfileire o que ainda estiver pendente.
            removeOnComplete: true,
            removeOnFail: true,
          },
        }),
        NotificacoesModule,
      ],
      providers: [LembretesAgendador, LembretesProcessor],
    };
  }
}
