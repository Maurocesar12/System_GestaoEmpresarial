import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { runComTenant, type TenantContext } from '../../infra/tenant/tenant-context';
import type { AuditoriaService } from '../plataforma/auditoria/auditoria.service';
import { FinanceiroService } from './financeiro.service';

/**
 * Baixa e estorno com duas requisições ao mesmo tempo.
 *
 * Dois cliques em "dar baixa" leem o lançamento em aberto ao mesmo tempo. Se a
 * gravação não repete a condição, os dois passam: a data da primeira baixa é
 * sobrescrita e a auditoria registra duas baixas. O `where` com `pagoEm` é o
 * que faz a segunda não casar com nenhuma linha (P2025) — e o banco real não
 * está aqui, então os testes conferem as duas metades: o `where` leva o estado
 * lido, e perder a corrida vira 409 sem auditoria duplicada.
 */
describe('FinanceiroService — baixa e estorno concorrentes', () => {
  const ID = '66666666-6666-6666-6666-666666666666';

  /** O que o Prisma lança quando o `where` do `update` não casa com nenhuma linha. */
  const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

  const tx = { lancamentoFinanceiro: { findUnique: jest.fn(), update: jest.fn() } };
  const comTenant = jest.fn((operacao: (t: typeof tx) => unknown) => operacao(tx));
  const registrar = jest.fn();

  const servico = new FinanceiroService(
    { comTenant } as unknown as PrismaService,
    { registrar } as unknown as AuditoriaService,
  );

  const contexto: TenantContext = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    papel: 'admin',
    permissoes: [],
    requestId: 'req-teste',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('darBaixa', () => {
    beforeEach(() => {
      tx.lancamentoFinanceiro.findUnique.mockResolvedValue({ pagoEm: null });
      tx.lancamentoFinanceiro.update.mockRejectedValue(nenhumaLinha());
    });

    it('só grava enquanto o lançamento segue em aberto', async () => {
      await runComTenant(contexto, () => servico.darBaixa(ID, { pagoEm: null })).catch(
        () => undefined,
      );

      expect(tx.lancamentoFinanceiro.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, pagoEm: null } }),
      );
    });

    it('perder a corrida vira 409 e não registra uma segunda baixa na auditoria', async () => {
      await expect(
        runComTenant(contexto, () => servico.darBaixa(ID, { pagoEm: null })),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(registrar).not.toHaveBeenCalled();
    });
  });

  describe('estornarBaixa', () => {
    beforeEach(() => {
      tx.lancamentoFinanceiro.findUnique.mockResolvedValue({
        pagoEm: new Date('2026-09-10T00:00:00.000Z'),
      });
      tx.lancamentoFinanceiro.update.mockRejectedValue(nenhumaLinha());
    });

    it('só estorna enquanto a baixa existe', async () => {
      await runComTenant(contexto, () => servico.estornarBaixa(ID)).catch(() => undefined);

      expect(tx.lancamentoFinanceiro.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, pagoEm: { not: null } } }),
      );
    });

    it('perder a corrida vira 409 e não registra um segundo estorno na auditoria', async () => {
      await expect(runComTenant(contexto, () => servico.estornarBaixa(ID))).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(registrar).not.toHaveBeenCalled();
    });
  });
});
