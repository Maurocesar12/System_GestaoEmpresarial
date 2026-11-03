import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Permissao } from '@gestao/shared-types';
import { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import { runComTenant, type TenantContext } from '../../../infra/tenant/tenant-context';
import type { FinanceiroService } from '../../financeiro/financeiro.service';
import type { ComissoesService } from '../../operacao/comissoes/comissoes.service';
import type { EstoqueService } from '../../operacao/estoque/estoque.service';
import { AgendamentosService } from './agendamentos.service';

/**
 * Recebimento na execução: a pergunta "e o pagamento?" que acompanha o
 * "Marcar como executado".
 *
 * O caminho completo, com banco, está no `agendamentos.int-spec.ts`. Aqui fica
 * o que precisa ser verdade mesmo sem banco: quem pode lançar, o que é lançado
 * e que o atalho não abre uma porta lateral para o financeiro.
 */
describe('AgendamentosService.mudarStatus — recebimento', () => {
  const CLIENTE = '22222222-2222-2222-2222-222222222222';
  const SERVICO = '33333333-3333-3333-3333-333333333333';

  const linha = (status: 'agendado' | 'executado') => ({
    id: '44444444-4444-4444-4444-444444444444',
    tenantId: '11111111-1111-1111-1111-111111111111',
    clienteId: CLIENTE,
    servicoId: SERVICO,
    // Sexta à noite, marcada como executada depois: a receita é da sexta.
    dataHora: new Date('2026-09-11T19:00:00.000Z'),
    observacoes: null,
    status,
    tecnicoId: null,
    orcamentoId: null,
    criadoEm: new Date('2026-09-01T12:00:00.000Z'),
    atualizadoEm: new Date('2026-09-01T12:00:00.000Z'),
    cliente: { nome: 'Ana Souza', telefone: null },
    servico: { nome: 'Limpeza de ar', precoPadrao: new Prisma.Decimal('150') },
    tecnico: null,
    orcamento: null,
  });

  const tx = {
    agendamento: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    atendimento: { create: jest.fn() },
  };

  const comTenant = jest.fn((operacao: (t: typeof tx) => unknown) => operacao(tx));
  const prisma = { comTenant } as unknown as PrismaService;

  const registrarReceitaDeServico = jest.fn();

  const servico = new AgendamentosService(
    prisma,
    { consumirNaExecucao: jest.fn() } as unknown as EstoqueService,
    { gerarExecucao: jest.fn() } as unknown as ComissoesService,
    { registrarReceitaDeServico } as unknown as FinanceiroService,
  );

  const contexto = (permissoes: Permissao[]): TenantContext => ({
    tenantId: '11111111-1111-1111-1111-111111111111',
    usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    papel: 'tecnico',
    permissoes,
    requestId: 'req-teste',
  });

  const comFinanceiro = contexto(['agenda.visualizar', 'agenda.gerenciar', 'financeiro.criar']);
  const semFinanceiro = contexto(['agenda.visualizar', 'agenda.gerenciar']);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.agendamento.findUnique.mockResolvedValue(linha('agendado'));
    tx.agendamento.update.mockResolvedValue(linha('executado'));
  });

  it('"Já recebi" lança a receita ligada ao serviço, ao cliente e ao dia do compromisso', async () => {
    await runComTenant(comFinanceiro, () =>
      servico.mudarStatus(linha('agendado').id, 'executar', undefined, {
        situacao: 'recebido',
        valor: '150.00',
      }),
    );

    expect(registrarReceitaDeServico).toHaveBeenCalledTimes(1);
    expect(registrarReceitaDeServico.mock.calls[0]?.[1]).toEqual({
      descricao: 'Limpeza de ar · Ana Souza',
      valor: '150.00',
      dia: '2026-09-11',
      servicoId: SERVICO,
      clienteId: CLIENTE,
      recebimento: { situacao: 'recebido', valor: '150.00' },
    });
  });

  it('"Vou receber" repassa o vencimento', async () => {
    await runComTenant(comFinanceiro, () =>
      servico.mudarStatus(linha('agendado').id, 'executar', undefined, {
        situacao: 'a_receber',
        valor: '150.00',
        vencimento: '2026-10-10',
      }),
    );

    expect(registrarReceitaDeServico.mock.calls[0]?.[1]).toMatchObject({
      recebimento: { situacao: 'a_receber', vencimento: '2026-10-10' },
    });
  });

  it('"Não lançar" executa sem tocar no financeiro', async () => {
    await runComTenant(semFinanceiro, () => servico.mudarStatus(linha('agendado').id, 'executar'));

    expect(tx.agendamento.update).toHaveBeenCalledTimes(1);
    expect(tx.atendimento.create).toHaveBeenCalledTimes(1);
    expect(registrarReceitaDeServico).not.toHaveBeenCalled();
  });

  // A brecha que esta regra fecha: `agenda.gerenciar` não pode virar um
  // caminho lateral para criar lançamento sem `financeiro.criar`.
  it('recusa lançar para quem não tem acesso ao financeiro — e não executa pela metade', async () => {
    await expect(
      runComTenant(semFinanceiro, () =>
        servico.mudarStatus(linha('agendado').id, 'executar', undefined, {
          situacao: 'recebido',
          valor: '150.00',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(comTenant).not.toHaveBeenCalled();
    expect(registrarReceitaDeServico).not.toHaveBeenCalled();
  });

  it('ignora o recebimento em ações que não são execução', async () => {
    await runComTenant(semFinanceiro, () =>
      servico.mudarStatus(linha('agendado').id, 'confirmar', undefined, {
        situacao: 'recebido',
        valor: '150.00',
      }),
    );

    expect(registrarReceitaDeServico).not.toHaveBeenCalled();
  });

  it('sugere o preço padrão do serviço quando não há orçamento', async () => {
    const resposta = await runComTenant(comFinanceiro, () =>
      servico.mudarStatus(linha('agendado').id, 'executar'),
    );

    expect(resposta.valorSugerido).toBe('150.00');
  });

  it('prefere o valor do orçamento ao preço de tabela', async () => {
    tx.agendamento.update.mockResolvedValue({
      ...linha('executado'),
      orcamento: { valor: new Prisma.Decimal('180.5') },
    });

    const resposta = await runComTenant(comFinanceiro, () =>
      servico.mudarStatus(linha('agendado').id, 'executar'),
    );

    expect(resposta.valorSugerido).toBe('180.50');
  });
});

/**
 * Duas requisições sobre o mesmo agendamento.
 *
 * Em READ COMMITTED, ler o status e gravar na mesma transação não impede que
 * outra requisição o mude no meio. O que impede é o status estar no `where` da
 * gravação: o Postgres o reavalia depois de esperar o lock, e a perdedora não
 * casa com nenhuma linha (P2025). O banco de verdade não está aqui, então os
 * testes conferem as duas metades do contrato: o `where` leva o estado lido, e
 * perder a corrida vira 409 antes de qualquer efeito colateral.
 */
describe('AgendamentosService — corrida entre requisições', () => {
  const ID = '44444444-4444-4444-4444-444444444444';

  const linha = (status: 'agendado' | 'confirmado' | 'executado') => ({
    id: ID,
    tenantId: '11111111-1111-1111-1111-111111111111',
    clienteId: '22222222-2222-2222-2222-222222222222',
    servicoId: '33333333-3333-3333-3333-333333333333',
    dataHora: new Date('2026-09-11T19:00:00.000Z'),
    observacoes: null,
    status,
    tecnicoId: null,
    orcamentoId: null,
    criadoEm: new Date('2026-09-01T12:00:00.000Z'),
    atualizadoEm: new Date('2026-09-01T12:00:00.000Z'),
    cliente: { nome: 'Ana Souza', telefone: null },
    servico: { nome: 'Limpeza de ar', precoPadrao: new Prisma.Decimal('150') },
    tecnico: null,
    orcamento: null,
  });

  /** O que o Prisma lança quando o `where` do `update` não casa com nenhuma linha. */
  const nenhumaLinha = () => Object.assign(new Error('Record not found'), { code: 'P2025' });

  const tx = {
    agendamento: { findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    atendimento: { create: jest.fn() },
    cliente: { findUnique: jest.fn() },
    servico: { findUnique: jest.fn() },
  };

  const comTenant = jest.fn((operacao: (t: typeof tx) => unknown) => operacao(tx));
  const consumirNaExecucao = jest.fn();
  const gerarExecucao = jest.fn();
  const registrarReceitaDeServico = jest.fn();

  const servico = new AgendamentosService(
    { comTenant } as unknown as PrismaService,
    { consumirNaExecucao } as unknown as EstoqueService,
    { gerarExecucao } as unknown as ComissoesService,
    { registrarReceitaDeServico } as unknown as FinanceiroService,
  );

  const contexto: TenantContext = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    papel: 'admin',
    permissoes: ['agenda.visualizar', 'agenda.gerenciar', 'financeiro.criar'],
    requestId: 'req-teste',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.agendamento.findUnique.mockResolvedValue(linha('agendado'));
  });

  describe('mudarStatus', () => {
    it('grava com o status que foi lido no where', async () => {
      tx.agendamento.update.mockResolvedValue(linha('executado'));

      await runComTenant(contexto, () => servico.mudarStatus(ID, 'executar'));

      expect(tx.agendamento.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID, status: 'agendado' } }),
      );
    });

    it('perder a corrida vira 409 e não repete atendimento, estoque, comissão nem receita', async () => {
      // Duas requisições "executar" leram "agendado". A primeira gravou; a
      // segunda não encontra mais a linha neste estado.
      tx.agendamento.update.mockRejectedValue(nenhumaLinha());

      await expect(
        runComTenant(contexto, () =>
          servico.mudarStatus(ID, 'executar', undefined, { situacao: 'recebido', valor: '150.00' }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.atendimento.create).not.toHaveBeenCalled();
      expect(consumirNaExecucao).not.toHaveBeenCalled();
      expect(gerarExecucao).not.toHaveBeenCalled();
      expect(registrarReceitaDeServico).not.toHaveBeenCalled();
    });

    it('toda mudança de status sobe a versão: reagendar não deixa uma edição velha salvar por cima', async () => {
      tx.agendamento.update.mockResolvedValue(linha('agendado'));

      await runComTenant(contexto, () => servico.mudarStatus(ID, 'confirmar'));

      expect(tx.agendamento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versao: { increment: 1 } }),
        }),
      );
    });

    it('um erro que não é de corrida segue como está, sem virar 409', async () => {
      tx.agendamento.update.mockRejectedValue(new Error('conexão perdida'));

      await expect(
        runComTenant(contexto, () => servico.mudarStatus(ID, 'confirmar')),
      ).rejects.toThrow('conexão perdida');
    });
  });

  describe('atualizar', () => {
    const dados = {
      clienteId: '22222222-2222-2222-2222-222222222222',
      servicoId: '33333333-3333-3333-3333-333333333333',
      dataHora: '2026-09-12T10:00',
    };

    beforeEach(() => {
      tx.cliente.findUnique.mockResolvedValue({ id: dados.clienteId });
      tx.servico.findUnique.mockResolvedValue({ id: dados.servicoId });
    });

    it('só altera enquanto o agendamento não foi executado nem cancelado', async () => {
      tx.agendamento.update.mockResolvedValue(linha('agendado'));

      await runComTenant(contexto, () => servico.atualizar(ID, dados as never));

      expect(tx.agendamento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID, status: { notIn: ['executado', 'cancelado'] } },
        }),
      );
    });

    it('com a versão da tela, o where a exige junto com o status e a gravação sobe a versão', async () => {
      tx.agendamento.update.mockResolvedValue(linha('agendado'));

      await runComTenant(contexto, () => servico.atualizar(ID, dados as never, 4));

      expect(tx.agendamento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID, status: { notIn: ['executado', 'cancelado'] }, versao: 4 },
          data: expect.objectContaining({ versao: { increment: 1 } }),
        }),
      );
    });

    it('a versão velha (outra pessoa editou antes) vira 409', async () => {
      tx.agendamento.update.mockRejectedValue(nenhumaLinha());

      await expect(
        runComTenant(contexto, () => servico.atualizar(ID, dados as never, 3)),
      ).rejects.toMatchObject({
        response: { mensagem: expect.stringContaining('depois que você abriu a tela') },
      });
    });

    it('perder a corrida para a execução vira 409', async () => {
      tx.agendamento.update.mockRejectedValue(nenhumaLinha());

      await expect(
        runComTenant(contexto, () => servico.atualizar(ID, dados as never)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remover', () => {
    it('só apaga o que ainda não foi executado', async () => {
      tx.agendamento.deleteMany.mockResolvedValue({ count: 1 });

      await runComTenant(contexto, () => servico.remover(ID));

      expect(tx.agendamento.deleteMany).toHaveBeenCalledWith({
        where: { id: ID, status: { not: 'executado' } },
      });
    });

    it('se a execução commitou no meio, não apaga e devolve 409', async () => {
      tx.agendamento.deleteMany.mockResolvedValue({ count: 0 });

      await expect(runComTenant(contexto, () => servico.remover(ID))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
