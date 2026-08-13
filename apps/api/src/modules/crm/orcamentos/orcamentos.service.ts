import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  ROTULO_ACAO,
  ROTULO_STATUS,
  TRANSICOES,
  acoesDisponiveis,
  type AcaoOrcamento,
  type Orcamento,
  type OrcamentoFormInput,
  type OrcamentosQuery,
  type Paginado,
  type ResumoOrcamentos,
  type StatusOrcamento,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
// Import de valor, e não `import type`: além dos tipos, o `Prisma.Decimal` é
// usado em tempo de execução para representar o zero quando não há orçamentos
// somados.
import { Prisma } from '../../../generated/prisma/client';

/** O registro do banco com as relações que a resposta precisa. */
type OrcamentoBanco = {
  id: string;
  clienteId: string;
  servicoId: string | null;
  descricao: string | null;
  valor: Prisma.Decimal;
  status: StatusOrcamento;
  validoAte: Date | null;
  respondidoEm: Date | null;
  criadoEm: Date;
  cliente: { nome: string };
  servico: { nome: string } | null;
};

@Injectable()
export class OrcamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: OrcamentosQuery): Promise<Paginado<Orcamento>> {
    const { pagina, porPagina, status, clienteId } = query;

    const where: Prisma.OrcamentoWhereInput = {};
    if (status) where.status = status;
    if (clienteId) where.clienteId = clienteId;

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.orcamento.findMany({
          where,
          include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } },
          orderBy: { criadoEm: 'desc' },
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        tx.orcamento.count({ where }),
      ]),
    );

    return {
      dados: registros.map((registro) => this.paraResposta(registro)),
      meta: {
        pagina,
        porPagina,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
      },
    };
  }

  /**
   * Totais por status.
   *
   * A soma é feita pelo banco, com `groupBy`, e não somando em JavaScript. Duas
   * razões: traria todos os orçamentos para a memória só para somá-los, e a
   * soma aconteceria em ponto flutuante — perdendo os centavos que o `NUMERIC`
   * existe para preservar.
   */
  async resumir(): Promise<ResumoOrcamentos> {
    const grupos = await this.prisma.comTenant((tx) =>
      tx.orcamento.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { valor: true },
      }),
    );

    const vazio = { quantidade: 0, valor: '0.00' };
    const resumo: ResumoOrcamentos = {
      abertos: { ...vazio },
      aprovados: { ...vazio },
      recusados: { ...vazio },
    };

    const chavePorStatus: Record<StatusOrcamento, keyof ResumoOrcamentos> = {
      aberto: 'abertos',
      aprovado: 'aprovados',
      recusado: 'recusados',
    };

    for (const grupo of grupos) {
      resumo[chavePorStatus[grupo.status]] = {
        quantidade: grupo._count._all,
        valor: (grupo._sum.valor ?? new Prisma.Decimal(0)).toFixed(2),
      };
    }

    return resumo;
  }

  async buscarPorId(id: string): Promise<Orcamento> {
    const orcamento = await this.prisma.comTenant((tx) =>
      tx.orcamento.findUnique({
        where: { id },
        include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } },
      }),
    );

    if (!orcamento) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Orçamento não encontrado.',
      });
    }

    return this.paraResposta(orcamento);
  }

  async criar(dados: OrcamentoFormInput): Promise<Orcamento> {
    const orcamento = await this.prisma.comTenant(async (tx) => {
      await this.garantirVinculosValidos(tx, dados);

      return tx.orcamento.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          descricao: dados.descricao,
          valor: dados.valor,
          validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
        },
        include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } },
      });
    });

    return this.paraResposta(orcamento);
  }

  /**
   * Altera um orçamento.
   *
   * Só enquanto está `aberto`. Mudar o valor de um orçamento já aprovado
   * significaria alterar um compromisso fechado — e, mais adiante, a receita
   * que ele gerou no financeiro.
   */
  async atualizar(id: string, dados: OrcamentoFormInput): Promise<Orcamento> {
    const atual = await this.buscarPorId(id);

    if (atual.status !== 'aberto') {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: `Este orçamento está ${ROTULO_STATUS[atual.status].toLowerCase()} e não pode mais ser alterado. Para mudar o combinado, emita um novo.`,
      });
    }

    const orcamento = await this.prisma.comTenant(async (tx) => {
      await this.garantirVinculosValidos(tx, dados);

      return tx.orcamento.update({
        where: { id },
        data: {
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          descricao: dados.descricao,
          valor: dados.valor,
          validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
        },
        include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } },
      });
    });

    return this.paraResposta(orcamento);
  }

  /**
   * Aplica uma ação da máquina de estados.
   *
   * A tabela de transições vem de `@gestao/shared-types`, a mesma que a tela
   * usa para decidir quais botões mostrar. Ainda assim a validação acontece
   * aqui: a tela esconder um botão é conveniência, não garantia — uma
   * requisição pode chegar de qualquer lugar.
   */
  async mudarStatus(id: string, acao: AcaoOrcamento): Promise<Orcamento> {
    const atual = await this.buscarPorId(id);
    const novoStatus = TRANSICOES[atual.status][acao];

    if (!novoStatus) {
      const possiveis = acoesDisponiveis(atual.status);

      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem:
          possiveis.length === 0
            ? `Um orçamento ${ROTULO_STATUS[atual.status].toLowerCase()} não aceita mais alterações de status.`
            : `Não é possível ${ROTULO_ACAO[acao].toLowerCase()} um orçamento ${ROTULO_STATUS[
                atual.status
              ].toLowerCase()}. Ações possíveis: ${possiveis.map((a) => ROTULO_ACAO[a].toLowerCase()).join(', ')}.`,
      });
    }

    const orcamento = await this.prisma.comTenant((tx) =>
      tx.orcamento.update({
        where: { id },
        data: {
          status: novoStatus,
          // Registra quando o cliente respondeu; reabrir limpa a marca, porque
          // a resposta anterior deixou de valer.
          respondidoEm: novoStatus === 'aberto' ? null : new Date(),
        },
        include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } },
      }),
    );

    return this.paraResposta(orcamento);
  }

  async remover(id: string): Promise<void> {
    const atual = await this.buscarPorId(id);

    if (atual.status === 'aprovado') {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem:
          'Orçamento aprovado não pode ser excluído — ele faz parte do histórico do cliente e do financeiro.',
      });
    }

    await this.prisma.comTenant((tx) => tx.orcamento.deleteMany({ where: { id } }));
  }

  /**
   * Confere que cliente e serviço existem nesta empresa.
   *
   * A RLS já impede atravessar empresas, mas sem esta checagem um id inexistente
   * viraria erro de chave estrangeira do Postgres — que não diz nada a quem
   * está preenchendo o formulário.
   */
  private async garantirVinculosValidos(
    tx: Parameters<Parameters<PrismaService['comTenant']>[0]>[0],
    dados: OrcamentoFormInput,
  ): Promise<void> {
    const cliente = await tx.cliente.findUnique({
      where: { id: dados.clienteId },
      select: { id: true },
    });

    if (!cliente) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Cliente não encontrado.',
      });
    }

    if (dados.servicoId) {
      const servico = await tx.servico.findUnique({
        where: { id: dados.servicoId },
        select: { id: true },
      });

      if (!servico) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Serviço não encontrado.',
        });
      }
    }
  }

  private paraResposta(registro: OrcamentoBanco): Orcamento {
    return {
      id: registro.id,
      clienteId: registro.clienteId,
      clienteNome: registro.cliente.nome,
      servicoId: registro.servicoId,
      servicoNome: registro.servico?.nome ?? null,
      descricao: registro.descricao,
      valor: registro.valor.toFixed(2),
      status: registro.status,
      // `validoAte` é uma data pura no banco (sem hora). Cortar em 10
      // caracteres evita que o fuso do servidor a empurre um dia para trás.
      validoAte: registro.validoAte?.toISOString().slice(0, 10) ?? null,
      respondidoEm: registro.respondidoEm?.toISOString() ?? null,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
