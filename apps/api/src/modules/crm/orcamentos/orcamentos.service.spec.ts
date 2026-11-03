import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { runComTenant, type TenantContext } from '../../../infra/tenant/tenant-context';
import type { ComissoesService } from '../../operacao/comissoes/comissoes.service';
import type { FunilService } from '../funil/funil.service';
import { OrcamentosService } from './orcamentos.service';

/**
 * Duas requisições sobre o mesmo orçamento.
 *
 * Em READ COMMITTED, ler o status e gravar na mesma transação não impede que
 * outra requisição o mude no meio. O que impede é o status estar no `where` da
 * gravação: o Postgres o reavalia depois de esperar o lock, e a perdedora não
 * casa com nenhuma linha (P2025). O banco de verdade não está aqui, então os
 * testes conferem as duas metades do contrato: o `where` leva o estado lido, e
 * perder a corrida vira 409 antes de qualquer efeito colateral.
 */
describe('OrcamentosService — corrida entre requisições', () => {
  const ID = '55555555-5555-5555-5555-555555555555';
  const CLIENTE = '22222222-2222-2222-2222-222222222222';

  const linha = (status: 'aberto' | 'aprovado' | 'recusado') => ({
    id: ID,
    tenantId: '11111111-1111-1111-1111-111111111111',
    clienteId: CLIENTE,
    servicoId: null,
    descricao: 'Instalação',
    valor: { toFixed: () => '500.00' },
    status,
    validoAte: null,
    respondidoEm: null,
    vendedorId: null,
    criadoEm: new Date('2026-09-01T12:00:00.000Z'),
    cliente: { nome: 'Ana Souza' },
    servico: null,
    vendedor: null,
  });

  /** O que o Prisma lança quando o `where` do `update` não casa com nenhuma linha. */
  const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

  const tx = {
    orcamento: { findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    cliente: { findUnique: jest.fn() },
  };

  const comTenant = jest.fn((operacao: (t: typeof tx) => unknown) => operacao(tx));
  const moverParaMarco = jest.fn();
  const gerarVenda = jest.fn();

  const servico = new OrcamentosService(
    { comTenant } as unknown as PrismaService,
    { moverParaMarco } as unknown as FunilService,
    { gerarVenda } as unknown as ComissoesService,
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
    tx.orcamento.findUnique.mockResolvedValue(linha('aberto'));
  });

  describe('mudarStatus', () => {
    it('grava com o status que foi lido no where', async () => {
      tx.orcamento.update.mockResolvedValue(linha('aprovado'));

      await runComTenant(contexto, () => servico.mudarStatus(ID, 'aprovar'));

      expect(tx.orcamento.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, status: 'aberto' } }),
      );
    });

    it('toda mudança de status sobe a versão: reabrir não deixa uma edição velha salvar por cima', async () => {
      tx.orcamento.update.mockResolvedValue(linha('aberto'));

      await runComTenant(contexto, () => servico.mudarStatus(ID, 'recusar'));

      expect(tx.orcamento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versao: { increment: 1 } }),
        }),
      );
    });

    it('perder a corrida vira 409 e não gera comissão nem move o cliente no funil', async () => {
      // "Aprovar" e "recusar" leram "aberto". A outra requisição gravou antes;
      // esta não encontra mais a linha neste estado. Sem a condição, o
      // orçamento acabaria recusado com comissão de venda já gerada.
      tx.orcamento.update.mockRejectedValue(nenhumaLinha());

      await expect(
        runComTenant(contexto, () => servico.mudarStatus(ID, 'aprovar')),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(moverParaMarco).not.toHaveBeenCalled();
      expect(gerarVenda).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    const dados = {
      clienteId: CLIENTE,
      descricao: 'Instalação',
      valor: '600.00',
    };

    beforeEach(() => {
      tx.cliente.findUnique.mockResolvedValue({ id: CLIENTE });
    });

    it('só altera enquanto o orçamento está aberto', async () => {
      tx.orcamento.update.mockResolvedValue(linha('aberto'));

      await runComTenant(contexto, () => servico.atualizar(ID, dados as never));

      expect(tx.orcamento.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, status: 'aberto' } }),
      );
    });

    it('com a versão da tela, o where a exige junto com o status e a gravação sobe a versão', async () => {
      tx.orcamento.update.mockResolvedValue(linha('aberto'));

      await runComTenant(contexto, () => servico.atualizar(ID, dados as never, 3));

      expect(tx.orcamento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID, status: 'aberto', versao: 3 },
          data: expect.objectContaining({ versao: { increment: 1 } }),
        }),
      );
    });

    it('a versão velha (outra pessoa editou antes) vira 409', async () => {
      tx.orcamento.update.mockRejectedValue(nenhumaLinha());

      await expect(
        runComTenant(contexto, () => servico.atualizar(ID, dados as never, 2)),
      ).rejects.toMatchObject({
        response: { mensagem: expect.stringContaining('depois que você abriu a tela') },
      });
    });

    it('perder a corrida para a aprovação vira 409', async () => {
      // A comissão já foi calculada sobre o valor antigo: mudar o valor agora
      // deixaria o orçamento aprovado com um valor que a comissão não reflete.
      tx.orcamento.update.mockRejectedValue(nenhumaLinha());

      await expect(
        runComTenant(contexto, () => servico.atualizar(ID, dados as never)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remover', () => {
    it('só apaga o que ainda não foi aprovado', async () => {
      tx.orcamento.deleteMany.mockResolvedValue({ count: 1 });

      await runComTenant(contexto, () => servico.remover(ID));

      expect(tx.orcamento.deleteMany).toHaveBeenCalledWith({
        where: { id: ID, status: { not: 'aprovado' } },
      });
    });

    it('se a aprovação commitou no meio, não apaga e devolve 409', async () => {
      tx.orcamento.deleteMany.mockResolvedValue({ count: 0 });

      await expect(runComTenant(contexto, () => servico.remover(ID))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
