import { NotFoundException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Excluir histórico não pode deixar rastro no histórico.
 *
 * É decisão de produto, e é fácil de perder sem querer: basta alguém voltar a
 * chamar `registrar` dentro da exclusão, ou tirar o `AuditoriaController` da
 * lista de controllers que o interceptor ignora. Estes testes seguram o lado
 * do serviço; `auditoria.interceptor.spec.ts` segura o outro.
 */
describe('AuditoriaService.removerVarios', () => {
  const tx = {
    logAuditoria: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const prisma = {
    comTenant: jest.fn((operacao: (transacao: typeof tx) => unknown) => operacao(tx)),
  } as unknown as PrismaService;

  const servico = new AuditoriaService(prisma);
  const id = '0198f1a0-0000-7000-8000-000000000001';

  beforeEach(() => jest.clearAllMocks());

  it('apaga os registros pedidos e não grava nada em troca', async () => {
    tx.logAuditoria.deleteMany.mockResolvedValue({ count: 2 });

    const removidos = await servico.removerVarios([id, '0198f1a0-0000-7000-8000-000000000002']);

    expect(removidos).toBe(2);
    expect(tx.logAuditoria.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [id, '0198f1a0-0000-7000-8000-000000000002'] } },
    });
    expect(tx.logAuditoria.create).not.toHaveBeenCalled();
  });

  it('ignora ids repetidos', async () => {
    tx.logAuditoria.deleteMany.mockResolvedValue({ count: 1 });

    await servico.removerVarios([id, id]);

    expect(tx.logAuditoria.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [id] } } });
  });

  it('não encosta no banco quando a lista chega vazia', async () => {
    expect(await servico.removerVarios([])).toBe(0);
    expect(tx.logAuditoria.deleteMany).not.toHaveBeenCalled();
  });

  it('devolve 404 quando o registro já não existe', async () => {
    tx.logAuditoria.deleteMany.mockResolvedValue({ count: 0 });

    await expect(servico.remover(id)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.logAuditoria.create).not.toHaveBeenCalled();
  });
});
