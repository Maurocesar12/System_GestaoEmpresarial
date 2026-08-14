import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  ROTULO_ACAO_AGENDAMENTO,
  ROTULO_STATUS_AGENDAMENTO,
  TRANSICOES_AGENDAMENTO,
  acoesAgendamentoDisponiveis,
  type AcaoAgendamento,
  type Agendamento,
  type AgendamentoFormInput,
  type AgendamentosQuery,
  type Paginado,
  type StatusAgendamento,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';
import { garantirClienteEServico } from '../vinculos';

/** Relações que toda resposta de agendamento precisa. */
const INCLUDE_PADRAO = {
  cliente: { select: { nome: true, telefone: true } },
  servico: { select: { nome: true } },
} as const;

/** O registro do banco, derivado do schema em vez de redigitado à mão. */
type AgendamentoBanco = Prisma.AgendamentoGetPayload<{ include: typeof INCLUDE_PADRAO }>;

@Injectable()
export class AgendamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: AgendamentosQuery): Promise<Paginado<Agendamento>> {
    const { pagina, porPagina, status, clienteId, de, ate } = query;

    const where: Prisma.AgendamentoWhereInput = {};
    if (status) where.status = status;
    if (clienteId) where.clienteId = clienteId;

    if (de || ate) {
      where.dataHora = {
        ...(de ? { gte: new Date(`${de}T00:00:00`) } : {}),
        // Fim do dia, não início: um filtro "até 20/08" precisa incluir os
        // compromissos das 14h daquele dia.
        ...(ate ? { lte: new Date(`${ate}T23:59:59.999`) } : {}),
      };
    }

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.agendamento.findMany({
          where,
          include: INCLUDE_PADRAO,
          // Cronológica, não por criação: uma agenda se lê pela ordem em que os
          // compromissos acontecem.
          orderBy: { dataHora: 'asc' },
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        tx.agendamento.count({ where }),
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

  async buscarPorId(id: string): Promise<Agendamento> {
    const agendamento = await this.prisma.comTenant((tx) =>
      tx.agendamento.findUnique({ where: { id }, include: INCLUDE_PADRAO }),
    );

    if (!agendamento) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Agendamento não encontrado.',
      });
    }

    return this.paraResposta(agendamento);
  }

  async criar(dados: AgendamentoFormInput): Promise<Agendamento> {
    const agendamento = await this.prisma.comTenant(async (tx) => {
      await garantirClienteEServico(tx, dados);

      return tx.agendamento.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          dataHora: new Date(dados.dataHora),
          observacoes: dados.observacoes,
        },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(agendamento);
  }

  /**
   * Altera um agendamento.
   *
   * Só enquanto está pendente. Mudar a data de algo já executado reescreveria
   * o histórico; de algo cancelado, confundiria o registro do que houve.
   */
  async atualizar(id: string, dados: AgendamentoFormInput): Promise<Agendamento> {
    const atual = await this.buscarPorId(id);

    if (atual.status === 'executado' || atual.status === 'cancelado') {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: `Este agendamento está ${ROTULO_STATUS_AGENDAMENTO[
          atual.status
        ].toLowerCase()} e não pode mais ser alterado.`,
      });
    }

    const agendamento = await this.prisma.comTenant(async (tx) => {
      await garantirClienteEServico(tx, dados);

      return tx.agendamento.update({
        where: { id },
        data: {
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          dataHora: new Date(dados.dataHora),
          observacoes: dados.observacoes,
        },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(agendamento);
  }

  /**
   * Aplica uma transição da máquina de estados.
   *
   * Marcar como executado **registra um atendimento no histórico do cliente**,
   * na mesma transação. É o fecho do ciclo: o compromisso cumprido vira o
   * registro do que foi feito, sem exigir que alguém digite duas vezes.
   */
  async mudarStatus(id: string, acao: AcaoAgendamento): Promise<Agendamento> {
    const atual = await this.buscarPorId(id);
    const novoStatus = TRANSICOES_AGENDAMENTO[atual.status][acao];

    if (!novoStatus) {
      const possiveis = acoesAgendamentoDisponiveis(atual.status);

      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem:
          possiveis.length === 0
            ? `Um agendamento ${ROTULO_STATUS_AGENDAMENTO[
                atual.status
              ].toLowerCase()} não aceita mais alterações.`
            : `Não é possível ${ROTULO_ACAO_AGENDAMENTO[acao].toLowerCase()} um agendamento ${ROTULO_STATUS_AGENDAMENTO[
                atual.status
              ].toLowerCase()}. Ações possíveis: ${possiveis
                .map((a) => ROTULO_ACAO_AGENDAMENTO[a].toLowerCase())
                .join(', ')}.`,
      });
    }

    const agendamento = await this.prisma.comTenant(async (tx) => {
      const atualizado = await tx.agendamento.update({
        where: { id },
        data: { status: novoStatus },
        include: INCLUDE_PADRAO,
      });

      if (novoStatus === 'executado') {
        await this.registrarAtendimento(tx, atualizado);
      }

      return atualizado;
    });

    return this.paraResposta(agendamento);
  }

  async remover(id: string): Promise<void> {
    const atual = await this.buscarPorId(id);

    if (atual.status === 'executado') {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem:
          'Agendamento executado não pode ser excluído — ele faz parte do histórico do cliente.',
      });
    }

    await this.prisma.comTenant((tx) => tx.agendamento.deleteMany({ where: { id } }));
  }

  /**
   * Registra no histórico o serviço que acabou de ser executado.
   *
   * O texto sai do serviço do catálogo, quando há um, ou das observações. Sem
   * isso, quem cumpriu o compromisso teria de digitar de novo no histórico o
   * que o sistema já sabia.
   */
  private async registrarAtendimento(
    tx: TransacaoComTenant,
    agendamento: AgendamentoBanco,
  ): Promise<void> {
    const descricao =
      agendamento.servico?.nome ??
      agendamento.observacoes ??
      'Serviço executado (agendamento sem descrição)';

    await tx.atendimento.create({
      data: {
        id: uuidv7(),
        tenantId: tenantAtual(),
        clienteId: agendamento.clienteId,
        descricao,
        // A data do atendimento é a do compromisso, não a de hoje: marcar como
        // executado na segunda-feira um serviço feito na sexta não pode gravar
        // segunda no histórico.
        data: new Date(agendamento.dataHora.toISOString().slice(0, 10)),
      },
    });
  }


  private paraResposta(registro: AgendamentoBanco): Agendamento {
    return {
      id: registro.id,
      clienteId: registro.clienteId,
      clienteNome: registro.cliente.nome,
      clienteTelefone: registro.cliente.telefone,
      servicoId: registro.servicoId,
      servicoNome: registro.servico?.nome ?? null,
      dataHora: registro.dataHora.toISOString(),
      observacoes: registro.observacoes,
      status: registro.status,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
