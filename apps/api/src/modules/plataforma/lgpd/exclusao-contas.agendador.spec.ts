import { DIAS_PARA_EXCLUIR_CONTA_CANCELADA, calcularExclusaoPrevista } from '@gestao/shared-types';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { ExclusaoContasAgendador } from './exclusao-contas.agendador';

const DIA_MS = 24 * 60 * 60 * 1000;

function montar(contas: Array<{ id: string; canceladoEm: Date | null }>, apagadas: number[]) {
  const findMany = jest.fn().mockResolvedValue(contas);
  const deleteMany = jest.fn();
  apagadas.forEach((count) => deleteMany.mockResolvedValueOnce({ count }));
  const create = jest.fn().mockResolvedValue({});

  const prisma = {
    semTenant: (_motivo: string, operacao: (db: unknown) => unknown) =>
      operacao({ tenant: { findMany } }),
    comTenantExplicito: (_tenantId: string, operacao: (tx: unknown) => unknown) =>
      operacao({ tenant: { deleteMany }, registroExclusaoConta: { create } }),
  } as unknown as PrismaService;

  return { agendador: new ExclusaoContasAgendador(prisma), findMany, deleteMany, create };
}

describe('ExclusaoContasAgendador', () => {
  const agora = new Date('2026-10-20T06:00:00Z');

  it('busca só contas canceladas antes do prazo publicado', async () => {
    const { agendador, findMany } = montar([], []);

    await agendador.excluirVencidas(agora);

    const corte = new Date(agora.getTime() - DIAS_PARA_EXCLUIR_CONTA_CANCELADA * DIA_MS);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'cancelado', canceladoEm: { lte: corte } } }),
    );
  });

  it('apaga a conta e grava o comprovante com a data de cancelamento', async () => {
    const canceladoEm = new Date('2026-09-01T12:00:00Z');
    const { agendador, deleteMany, create } = montar([{ id: 'conta-1', canceladoEm }], [1]);

    await expect(agendador.excluirVencidas(agora)).resolves.toBe(1);

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'conta-1', status: 'cancelado' } });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'conta-1', canceladoEm }),
    });
  });

  it('não grava comprovante quando a conta foi reativada entre a busca e a exclusão', async () => {
    const { agendador, create } = montar(
      [{ id: 'conta-1', canceladoEm: new Date('2026-09-01T12:00:00Z') }],
      [0],
    );

    await expect(agendador.excluirVencidas(agora)).resolves.toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('segue para as próximas contas quando uma falha', async () => {
    const canceladoEm = new Date('2026-09-01T12:00:00Z');
    const { agendador, deleteMany } = montar(
      [
        { id: 'conta-1', canceladoEm },
        { id: 'conta-2', canceladoEm },
      ],
      [],
    );
    deleteMany.mockRejectedValueOnce(new Error('falha')).mockResolvedValueOnce({ count: 1 });

    await expect(agendador.excluirVencidas(agora)).resolves.toBe(1);
  });
});

describe('calcularExclusaoPrevista', () => {
  it('soma o prazo publicado à data do cancelamento', () => {
    expect(calcularExclusaoPrevista(new Date('2026-09-15T10:00:00Z')).toISOString()).toBe(
      '2026-10-15T10:00:00.000Z',
    );
  });
});
