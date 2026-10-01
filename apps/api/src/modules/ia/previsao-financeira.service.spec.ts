import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { Prisma } from '../../generated/prisma/client';
import type { AssistenteIa, ResultadoAssistenteIa } from '../../infra/ia/assistente-ia';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { runComTenant } from '../../infra/tenant/tenant-context';
import type { AuditoriaService } from '../plataforma/auditoria/auditoria.service';
import { PrevisaoFinanceiraService } from './previsao-financeira.service';

const ANALISE: ResultadoAssistenteIa['analise'] = {
  resumo: 'Caixa estável.',
  nivelRisco: 'baixo',
  pontosAtencao: [],
  acoesRecomendadas: [],
  avisos: [],
};

/** Lançamentos pagos espalhados pelos últimos `meses` meses fechados. */
function lancamentosPagos(meses: number, porMes: number) {
  const agora = new Date();
  return Array.from({ length: meses * porMes }, (_, indice) => ({
    tipo: indice % 2 === 0 ? 'entrada' : 'saida',
    valor: new Prisma.Decimal(indice % 2 === 0 ? '1000.00' : '400.00'),
    pagoEm: new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1 - Math.floor(indice / porMes), 15),
    ),
  }));
}

/**
 * Uma transação de mentira, respondendo pelo que a consulta pede e não pela
 * ordem das chamadas — `calcular` dispara tudo num `Promise.all`, e depender da
 * ordem tornaria o teste frágil a qualquer reorganização das consultas.
 */
function montar(opcoes: { pagos: ReturnType<typeof lancamentosPagos>; usado?: number }) {
  const vazio = { _sum: { valor: null }, _count: { _all: 0 }, _avg: { valor: null } };

  const previsao = {
    count: jest.fn().mockResolvedValue(opcoes.usado ?? 0),
    create: jest.fn().mockResolvedValue({ id: 'reserva-1' }),
    update: jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ id: 'reserva-1', criadoEm: new Date(), ...data }),
      ),
  };

  const tx = {
    $executeRaw: jest.fn(),
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        plano: { nome: 'Premium', iaHabilitada: true, limitePrevisoesIaMensais: 200 },
      }),
    },
    previsaoFinanceira: previsao,
    lancamentoFinanceiro: {
      // Contas futuras são as sem baixa; o resto é o histórico pago.
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { pagoEm: unknown } }) =>
          Promise.resolve(where.pagoEm === null ? [] : opcoes.pagos),
        ),
      aggregate: jest.fn().mockResolvedValue(vazio),
      count: jest.fn().mockResolvedValue(opcoes.pagos.length),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    cliente: { count: jest.fn().mockResolvedValue(0) },
    orcamento: {
      aggregate: jest.fn().mockResolvedValue(vazio),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    agendamento: { count: jest.fn().mockResolvedValue(0) },
    proLabore: { findFirst: jest.fn().mockResolvedValue(null) },
    categoriaFinanceira: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const prisma = {
    comTenant: <T>(operacao: (transacao: typeof tx) => Promise<T>) => operacao(tx),
  } as unknown as PrismaService;

  const assistente = { analisarPrevisao: jest.fn() };
  const config = new ConfigService<Env, true>({
    OPENAI_CUSTO_INPUT_USD_MILHAO: 0.2,
    OPENAI_CUSTO_OUTPUT_USD_MILHAO: 1.2,
  });
  const auditoria = { registrar: jest.fn() } as unknown as AuditoriaService;

  const service = new PrevisaoFinanceiraService(
    prisma,
    assistente as unknown as AssistenteIa,
    config,
    auditoria,
  );

  return { service, previsao, assistente };
}

function noTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runComTenant(
    { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'admin', requestId: 'teste' },
    fn,
  );
}

const PEDIDO = { mesesHistorico: 6, mesesProjecao: 3 };

describe('PrevisaoFinanceiraService.gerar', () => {
  it('recusa a empresa sem histórico antes de reservar cota ou chamar a IA', async () => {
    const { service, previsao, assistente } = montar({ pagos: lancamentosPagos(1, 2) });

    await expect(noTenant(() => service.gerar(PEDIDO))).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    expect(previsao.count).not.toHaveBeenCalled();
    expect(previsao.create).not.toHaveBeenCalled();
    expect(assistente.analisarPrevisao).not.toHaveBeenCalled();
  });

  it('explica na recusa o que falta, para a tela mostrar', async () => {
    const { service } = montar({ pagos: lancamentosPagos(1, 2) });

    await expect(noTenant(() => service.gerar(PEDIDO))).rejects.toMatchObject({
      response: { mensagem: expect.stringContaining('Hoje há 1 mês com movimento') },
    });
  });

  it('conta na cota a previsão que a IA analisou', async () => {
    const { service, assistente } = montar({ pagos: lancamentosPagos(3, 4), usado: 5 });
    assistente.analisarPrevisao.mockResolvedValue({
      modo: 'openai',
      modelo: 'modelo-teste',
      analise: ANALISE,
      inputTokens: 1000,
      outputTokens: 300,
    });

    const resposta = await noTenant(() => service.gerar(PEDIDO));

    expect(resposta.modo).toBe('openai');
    expect(resposta.quota).toEqual({ usado: 6, limite: 200 });
  });

  // O cliente não escolheu a falha do fornecedor; o limite do Premium não
  // deve pagar por ela.
  it('não conta na cota quando a IA falhou e a análise foi local', async () => {
    const { service, assistente } = montar({ pagos: lancamentosPagos(3, 4), usado: 5 });
    assistente.analisarPrevisao.mockResolvedValue({
      modo: 'demonstracao',
      modelo: 'analise-local',
      analise: ANALISE,
      inputTokens: 0,
      outputTokens: 0,
    });

    const resposta = await noTenant(() => service.gerar(PEDIDO));

    expect(resposta.modo).toBe('demonstracao');
    expect(resposta.quota).toEqual({ usado: 5, limite: 200 });
  });

  it('mede a cota só pelas previsões da IA e pelas reservas em andamento', async () => {
    const { service, previsao, assistente } = montar({ pagos: lancamentosPagos(3, 4) });
    assistente.analisarPrevisao.mockResolvedValue({
      modo: 'openai',
      modelo: 'modelo-teste',
      analise: ANALISE,
      inputTokens: 0,
      outputTokens: 0,
    });

    await noTenant(() => service.gerar(PEDIDO));

    expect(previsao.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ modo: 'openai' }, { modelo: 'processando', criadoEm: { gte: expect.any(Date) } }],
      }),
    });
  });
});
