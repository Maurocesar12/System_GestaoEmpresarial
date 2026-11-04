import type { Queue } from 'bullmq';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import { TEMPO_MAXIMO_ENVIANDO_MS, type PayloadEnvioLembrete } from './envio.constantes';
import { LembretesAgendador } from './lembretes.agendador';

const T1 = '0198f1a0-0000-7000-8000-0000000000a1';
const L1 = '0198f1a0-0000-7000-8000-0000000000b1';
const L2 = '0198f1a0-0000-7000-8000-0000000000b2';

type FiltroVarredura = {
  OR: Array<{
    status: string;
    dataEnvio?: { lte: Date };
    OR?: Array<{ iniciadoEm: null | { lt: Date } }>;
  }>;
};

describe('LembretesAgendador — varredura', () => {
  const findMany = jest.fn();
  const addBulk = jest.fn();
  const comVarredura = jest.fn(
    (_nome: string, _motivo: string, op: (db: unknown) => Promise<unknown>) =>
      op({ lembreteFollowUp: { findMany } }),
  );

  const agendador = new LembretesAgendador(
    { comVarredura } as unknown as PrismaService,
    { addBulk } as unknown as Queue<PayloadEnvioLembrete>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it('busca os pendentes vencidos e também os que travaram em "enviando"', async () => {
    const antes = Date.now();

    await agendador.enfileirarVencidos();

    const { where } = (findMany.mock.calls[0] as [{ where: FiltroVarredura }])[0];
    const [pendentes, travados] = where.OR;

    expect(pendentes).toMatchObject({ status: 'pendente', dataEnvio: { lte: expect.any(Date) } });
    expect(travados).toMatchObject({ status: 'enviando' });

    // Travado = reivindicado há mais que o prazo (ou sem início registrado).
    expect(travados!.OR).toContainEqual({ iniciadoEm: null });
    const corte = travados!.OR!.find((c) => c.iniciadoEm !== null)!.iniciadoEm as { lt: Date };
    expect(corte.lt.getTime()).toBeLessThanOrEqual(antes - TEMPO_MAXIMO_ENVIANDO_MS + 1000);
  });

  it('declara a varredura "lembretes": sem isso a política de RLS não mostra nada', async () => {
    await agendador.enfileirarVencidos();

    expect(comVarredura).toHaveBeenCalledWith(
      'lembretes',
      expect.any(String),
      expect.any(Function),
    );
  });

  it('enfileira cada lembrete com o próprio id como jobId (sem duplicata na fila)', async () => {
    findMany.mockResolvedValue([
      { id: L1, tenantId: T1 },
      { id: L2, tenantId: T1 },
    ]);

    await agendador.enfileirarVencidos();

    const jobs = (
      addBulk.mock.calls[0] as [Array<{ data: PayloadEnvioLembrete; opts: { jobId: string } }>]
    )[0];
    expect(jobs.map((j) => j.opts.jobId)).toEqual([L1, L2]);
    expect(jobs.map((j) => j.data)).toEqual([
      { lembreteId: L1, tenantId: T1 },
      { lembreteId: L2, tenantId: T1 },
    ]);
  });

  it('sem nada a enviar, não toca na fila', async () => {
    await agendador.enfileirarVencidos();

    expect(addBulk).not.toHaveBeenCalled();
  });

  it('uma falha na varredura não derruba o agendador', async () => {
    findMany.mockRejectedValue(new Error('redis fora'));

    await expect(agendador.enfileirarVencidos()).resolves.toBeUndefined();
  });
});
