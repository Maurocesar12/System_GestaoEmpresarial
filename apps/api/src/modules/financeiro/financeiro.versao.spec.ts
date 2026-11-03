import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { runComTenant, type TenantContext } from '../../infra/tenant/tenant-context';
import type { AuditoriaService } from '../plataforma/auditoria/auditoria.service';
import { FinanceiroService } from './financeiro.service';

const ID = '66666666-6666-6666-6666-666666666666';
const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

const dados = {
  tipo: 'entrada' as const,
  natureza: 'empresa' as const,
  descricao: 'Serviço',
  valor: '100.00',
  data: '2026-10-01',
  vencimento: null,
  pagoEm: null,
  categoriaId: null,
  servicoId: null,
  clienteId: null,
  anexos: [],
  parcelas: 1,
};

const contexto: TenantContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  papel: 'admin',
  permissoes: [],
  requestId: 'req-teste',
};

/**
 * Edição de lançamento com a versão da tela.
 *
 * O caso que importa: a tela de edição foi aberta, alguém deu baixa, e só então
 * a edição é salva. Sem a versão, ela reescreveria `pagoEm` com o valor antigo
 * (em aberto) e desfaria a baixa sem aviso.
 */
describe('FinanceiroService — controle otimista (If-Match)', () => {
  const tx = {
    lancamentoFinanceiro: { findUnique: jest.fn(), update: jest.fn() },
  };
  const comTenant = jest.fn((operacao: (t: typeof tx) => unknown) => operacao(tx));
  const servico = new FinanceiroService(
    { comTenant } as unknown as PrismaService,
    { registrar: jest.fn() } as unknown as AuditoriaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.lancamentoFinanceiro.findUnique.mockResolvedValue({ id: ID, categoriaId: null });
    tx.lancamentoFinanceiro.update.mockRejectedValue(nenhumaLinha());
  });

  const atualizar = (versao?: number) =>
    runComTenant(contexto, () => servico.atualizar(ID, dados, versao));

  it('a versão da tela vai no where e a gravação sobe a versão', async () => {
    await atualizar(3).catch(() => undefined);

    expect(tx.lancamentoFinanceiro.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID, versao: 3 },
        data: expect.objectContaining({ versao: { increment: 1 } }),
      }),
    );
  });

  it('a versão velha (a baixa subiu a versão no meio): 409, e a edição não é aplicada', async () => {
    await expect(atualizar(3)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sem versão, o where só leva o id', async () => {
    await atualizar().catch(() => undefined);

    expect(tx.lancamentoFinanceiro.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID } }),
    );
  });

  it('dar baixa e estornar sobem a versão', async () => {
    tx.lancamentoFinanceiro.findUnique.mockResolvedValueOnce({ pagoEm: null });
    await runComTenant(contexto, () => servico.darBaixa(ID, { pagoEm: null })).catch(
      () => undefined,
    );
    expect(tx.lancamentoFinanceiro.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versao: { increment: 1 } }),
      }),
    );

    tx.lancamentoFinanceiro.findUnique.mockResolvedValueOnce({ pagoEm: new Date('2026-10-02') });
    await runComTenant(contexto, () => servico.estornarBaixa(ID)).catch(() => undefined);
    expect(tx.lancamentoFinanceiro.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { pagoEm: null, versao: { increment: 1 } },
      }),
    );
  });
});
