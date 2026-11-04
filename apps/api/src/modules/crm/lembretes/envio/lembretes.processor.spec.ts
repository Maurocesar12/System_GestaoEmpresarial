import type { Job } from 'bullmq';
import { ErroDeNotificacao } from '../../../../infra/notificacoes/notificador';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import { TEMPO_MAXIMO_ENVIANDO_MS, type PayloadEnvioLembrete } from './envio.constantes';
import { LembretesProcessor } from './lembretes.processor';

const TENANT = '0198f1a0-0000-7000-8000-000000000001';
const LEMBRETE = '0198f1a0-0000-7000-8000-000000000002';

type LembreteCarregado = {
  status: 'pendente' | 'enviando' | 'enviado' | 'falhou' | 'cancelado';
  canal: 'email' | 'whatsapp';
  cliente: { nome: string; email: string | null };
  tenant: { nome: string };
};

const LEMBRETE_PENDENTE: LembreteCarregado = {
  status: 'pendente',
  canal: 'email',
  cliente: { nome: 'Maria Souza', email: 'maria@exemplo.com' },
  tenant: { nome: 'Oficina do João' },
};

/**
 * Monta o processador com banco e notificador de mentira.
 *
 * O `comTenantExplicito` falso apenas repassa a transação simulada. O que
 * interessa nestes testes é a decisão de status — quem reivindica, quem envia,
 * quem desiste e quem tenta de novo —, não o caminho até o PostgreSQL, que os
 * testes de integração cobrem.
 *
 * @param reivindica Se a reivindicação (`pendente -> enviando`) casa uma linha.
 *   `false` simula o lembrete já cancelado, já enviado ou nas mãos de outro job.
 * @param cota Limite mensal do plano (`null` = sem teto) e envios já usados.
 */
function criarAmbiente(
  lembrete: LembreteCarregado | null,
  erroDeEnvio?: Error,
  reivindica = true,
  cota: { limite: number | null; usados: number } = { limite: null, usados: 0 },
) {
  const findUnique = jest.fn(() => Promise.resolve(lembrete));
  const updateMany = jest.fn(() => Promise.resolve({ count: reivindica ? 1 : 0 }));
  const update = jest.fn(() => Promise.resolve({}));
  const count = jest.fn(() => Promise.resolve(cota.usados));
  const travar = jest.fn(() => Promise.resolve(1));
  const enviar = jest.fn(() => (erroDeEnvio ? Promise.reject(erroDeEnvio) : Promise.resolve()));

  const transacao = {
    $executeRaw: travar,
    tenant: {
      findUniqueOrThrow: jest.fn(() =>
        Promise.resolve({ plano: { nome: 'Básico', limiteEnviosMensais: cota.limite } }),
      ),
    },
    lembreteFollowUp: { findUnique, updateMany, update, count },
  };

  const comTenantExplicito = jest.fn(
    (_tenantId: string, operacao: (tx: unknown) => Promise<unknown>) => operacao(transacao),
  );

  // O `Notificador` declara só `enviar`, então o objeto abaixo já satisfaz o
  // contrato e dispensa conversão. O PrismaService tem superfície bem maior, e
  // aí a conversão é necessária para não precisar simular métodos que estes
  // testes nunca chamam.
  const processador = new LembretesProcessor({ comTenantExplicito } as unknown as PrismaService, {
    enviar,
  });

  return { processador, findUnique, updateMany, update, count, travar, enviar, comTenantExplicito };
}

function criarJob(data: Partial<PayloadEnvioLembrete> = {}): Job<PayloadEnvioLembrete> {
  return {
    id: 'job-1',
    data: { lembreteId: LEMBRETE, tenantId: TENANT, ...data },
  } as Job<PayloadEnvioLembrete>;
}

/** Extrai o `data` do `update` mais recente. */
function ultimaGravacao(update: jest.Mock): Record<string, unknown> {
  const chamada = update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };

  return chamada.data;
}

describe('LembretesProcessor', () => {
  it('envia o lembrete e o marca como enviado', async () => {
    const { processador, enviar, update } = criarAmbiente(LEMBRETE_PENDENTE);

    await processador.process(criarJob());

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(ultimaGravacao(update)).toMatchObject({ status: 'enviado', erro: null });
  });

  it('abre o escopo da empresa antes de qualquer acesso ao banco', async () => {
    // O worker roda fora de requisição: se o tenant do job não for aplicado,
    // não há isolamento nenhum protegendo a consulta.
    const { processador, comTenantExplicito } = criarAmbiente(LEMBRETE_PENDENTE);

    await processador.process(criarJob());

    expect(comTenantExplicito).toHaveBeenCalledWith(TENANT, expect.any(Function));
  });

  it('recusa job sem tenant em vez de rodar sem escopo', async () => {
    const { processador, findUnique } = criarAmbiente(LEMBRETE_PENDENTE);

    await expect(processador.process(criarJob({ tenantId: '' }))).rejects.toThrow(/tenantId/);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('ignora lembrete que não existe mais', async () => {
    const { processador, enviar, updateMany, update } = criarAmbiente(null);

    await processador.process(criarJob());

    expect(enviar).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  describe('reivindicação (pendente -> enviando)', () => {
    it('reivindica antes de enviar, num único UPDATE condicional', async () => {
      const { processador, updateMany, enviar } = criarAmbiente(LEMBRETE_PENDENTE);
      const ordem: string[] = [];
      updateMany.mockImplementation(() => {
        ordem.push('reivindica');
        return Promise.resolve({ count: 1 });
      });
      enviar.mockImplementation(() => {
        ordem.push('envia');
        return Promise.resolve();
      });

      await processador.process(criarJob());

      expect(ordem).toEqual(['reivindica', 'envia']);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: LEMBRETE,
          OR: [
            { status: 'pendente' },
            {
              status: 'enviando',
              OR: [{ iniciadoEm: null }, { iniciadoEm: { lt: expect.any(Date) } }],
            },
          ],
        },
        data: { status: 'enviando', iniciadoEm: expect.any(Date) },
      });
    });

    it('perdeu a reivindicação (cancelado, já enviado ou em outro job): não envia nada', async () => {
      // O caso que o status "enviando" existe para cobrir: dois jobs do mesmo
      // lembrete, ou um cancelamento que chegou antes. Quem perde não envia e
      // não grava desfecho nenhum.
      const { processador, enviar, update } = criarAmbiente(
        { ...LEMBRETE_PENDENTE, status: 'cancelado' },
        undefined,
        false,
      );

      await processador.process(criarJob());

      expect(enviar).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('só retoma um "enviando" depois do prazo de travado', async () => {
      const { processador, updateMany } = criarAmbiente({
        ...LEMBRETE_PENDENTE,
        status: 'enviando',
      });
      const antes = Date.now();

      await processador.process(criarJob());

      const { where } = (
        updateMany.mock.calls[0] as unknown as [
          {
            where: {
              OR: Array<{ status: string; OR?: Array<{ iniciadoEm?: { lt: Date } | null }> }>;
            };
          },
        ]
      )[0];
      const limite = where.OR[1]!.OR![1]!.iniciadoEm as { lt: Date };

      // O corte é "agora menos o prazo": um envio em curso (poucos segundos) fica de fora.
      expect(limite.lt.getTime()).toBeLessThanOrEqual(antes - TEMPO_MAXIMO_ENVIANDO_MS + 1000);
      expect(limite.lt.getTime()).toBeGreaterThan(antes - TEMPO_MAXIMO_ENVIANDO_MS - 5000);
    });
  });

  /**
   * Limite mensal de envios do plano — a mesma regra para todos os planos,
   * cada um com o seu número (Básico 300, Premium 2.000).
   */
  describe('limite mensal de envios do plano', () => {
    it('dentro do limite, envia normalmente', async () => {
      const { processador, enviar } = criarAmbiente(LEMBRETE_PENDENTE, undefined, true, {
        limite: 300,
        usados: 299,
      });

      await processador.process(criarJob());

      expect(enviar).toHaveBeenCalledTimes(1);
    });

    it('no limite, não envia e marca como falhou com o motivo', async () => {
      const { processador, enviar, updateMany } = criarAmbiente(
        LEMBRETE_PENDENTE,
        undefined,
        true,
        { limite: 300, usados: 300 },
      );

      await processador.process(criarJob());

      expect(enviar).not.toHaveBeenCalled();
      const { data } = (updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0];
      expect(data).toMatchObject({ status: 'falhou', iniciadoEm: null });
      expect(String(data.erro)).toMatch(/Básico permite 300 envio/);
    });

    it('trava a empresa antes de contar: dois jobs simultâneos não passam juntos', async () => {
      const { processador, travar, count } = criarAmbiente(LEMBRETE_PENDENTE, undefined, true, {
        limite: 300,
        usados: 10,
      });
      const ordem: string[] = [];
      travar.mockImplementation(() => {
        ordem.push('trava');
        return Promise.resolve(1);
      });
      count.mockImplementation(() => {
        ordem.push('conta');
        return Promise.resolve(10);
      });

      await processador.process(criarJob());

      expect(ordem).toEqual(['trava', 'conta']);
    });

    it('conta o que saiu no mês e o que está saindo agora, sem contar o próprio lembrete', async () => {
      const { processador, count } = criarAmbiente(LEMBRETE_PENDENTE, undefined, true, {
        limite: 300,
        usados: 0,
      });

      await processador.process(criarJob());

      expect(count).toHaveBeenCalledWith({
        where: {
          id: { not: LEMBRETE },
          OR: [
            { status: 'enviado', enviadoEm: { gte: expect.any(Date) } },
            { status: 'enviando', iniciadoEm: { gte: expect.any(Date) } },
          ],
        },
      });
    });

    it('plano sem teto não conta nada', async () => {
      const { processador, count, enviar } = criarAmbiente(LEMBRETE_PENDENTE);

      await processador.process(criarJob());

      expect(count).not.toHaveBeenCalled();
      expect(enviar).toHaveBeenCalledTimes(1);
    });
  });

  it('marca WhatsApp como falha explicando que o canal não está disponível', async () => {
    // Deixar pendente para sempre esconderia o problema do usuário; falhar com
    // motivo o traz para a tela.
    const { processador, enviar, update } = criarAmbiente({
      ...LEMBRETE_PENDENTE,
      canal: 'whatsapp',
    });

    await processador.process(criarJob());

    expect(enviar).not.toHaveBeenCalled();
    expect(ultimaGravacao(update)).toMatchObject({ status: 'falhou' });
    expect(String(ultimaGravacao(update).erro)).toContain('WhatsApp');
  });

  it('encerra como falhou quando o erro é permanente, sem pedir nova tentativa', async () => {
    const { processador, update } = criarAmbiente(
      LEMBRETE_PENDENTE,
      new ErroDeNotificacao('Destinatário sem endereço de e-mail cadastrado.', true),
    );

    await expect(processador.process(criarJob())).resolves.toBeUndefined();

    expect(ultimaGravacao(update)).toMatchObject({ status: 'falhou' });
  });

  it('devolve a pendente e relança quando o erro é temporário', async () => {
    // Relançar é o que faz o BullMQ contar a tentativa e reagendar com espera.
    // Voltar a `pendente` é o que deixa o retry reivindicar o lembrete de novo.
    const { processador, update } = criarAmbiente(
      LEMBRETE_PENDENTE,
      new ErroDeNotificacao('Servidor SMTP indisponível.', false),
    );

    await expect(processador.process(criarJob())).rejects.toThrow(/SMTP/);

    expect(ultimaGravacao(update)).toMatchObject({ status: 'pendente', iniciadoEm: null });
  });

  it('um erro ao montar a mensagem não deixa o lembrete preso em "enviando"', async () => {
    // Depois da reivindicação, qualquer falha precisa chegar a um estado
    // resolvido. Sem o `try` em volta da montagem, o lembrete só se resolveria
    // pela recuperação de travados, quinze minutos depois.
    const { processador, update } = criarAmbiente({
      ...LEMBRETE_PENDENTE,
      cliente: null as never,
    });

    await expect(processador.process(criarJob())).rejects.toThrow();

    expect(ultimaGravacao(update)).toMatchObject({ status: 'pendente' });
  });

  describe('o desfecho só vale enquanto este job é dono do lembrete', () => {
    // O cancelamento não chega mais aqui (só cancela `pendente`). O que faz a
    // gravação não casar (P2025) é o lembrete ter sido excluído ou retomado por
    // outro job depois de parecer travado.
    const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

    it('grava o desfecho só enquanto o lembrete segue "enviando", e limpa o início', async () => {
      const { processador, update } = criarAmbiente(LEMBRETE_PENDENTE);

      await processador.process(criarJob());

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: LEMBRETE, status: 'enviando' },
          data: expect.objectContaining({ iniciadoEm: null }),
        }),
      );
    });

    it('não grava por cima de um lembrete retomado, e o erro do envio continua subindo', async () => {
      const { processador, update } = criarAmbiente(
        LEMBRETE_PENDENTE,
        new ErroDeNotificacao('Servidor SMTP indisponível.', false),
      );
      update.mockRejectedValue(nenhumaLinha());

      await expect(processador.process(criarJob())).rejects.toThrow(/SMTP/);
    });

    it('não falha o job quando o envio deu certo mas o lembrete foi excluído', async () => {
      const { processador, enviar, update } = criarAmbiente(LEMBRETE_PENDENTE);
      update.mockRejectedValue(nenhumaLinha());

      await expect(processador.process(criarJob())).resolves.toBeUndefined();

      expect(enviar).toHaveBeenCalledTimes(1);
    });

    it('não engole erros de banco que não são de corrida', async () => {
      const { processador, update } = criarAmbiente(LEMBRETE_PENDENTE);
      update.mockRejectedValue(new Error('conexão perdida'));

      await expect(processador.process(criarJob())).rejects.toThrow('conexão perdida');
    });
  });

  it('registra o motivo da falha para o suporte conseguir explicar depois', async () => {
    const { processador, update } = criarAmbiente(
      LEMBRETE_PENDENTE,
      new ErroDeNotificacao('Caixa de entrada inexistente.', true),
    );

    await processador.process(criarJob());

    expect(ultimaGravacao(update).erro).toBe('Caixa de entrada inexistente.');
  });
});
