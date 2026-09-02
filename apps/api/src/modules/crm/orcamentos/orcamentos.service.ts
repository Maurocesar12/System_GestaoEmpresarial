import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
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
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import { FunilService } from '../funil/funil.service';
import { garantirVinculos } from '../../../common/vinculos';
// Import de valor, e não `import type`: além dos tipos, o `Prisma.Decimal` é
// usado em tempo de execução para representar o zero quando não há orçamentos
// somados.
import { Prisma } from '../../../generated/prisma/client';

/** As relações que toda resposta de orçamento carrega. */
const INCLUDE_PADRAO = {
  cliente: { select: { nome: true } },
  servico: { select: { nome: true } },
} as const;

/** O registro do banco, derivado do schema em vez de redigitado à mão. */
type OrcamentoBanco = Prisma.OrcamentoGetPayload<{ include: typeof INCLUDE_PADRAO }>;

/**
 * Orçamentos.
 *
 * ## Ligação com o funil
 *
 * Emitir um orçamento e aprová-lo movem o cliente no funil automaticamente —
 * para a etapa marcada como `orcamento_enviado` e `fechado`, respectivamente
 * (arquitetura §12, "movimentação automática").
 *
 * A movimentação acontece **dentro da mesma transação** da operação que a
 * disparou. Se o orçamento for gravado e a movimentação falhar, as duas são
 * desfeitas — nada de orçamento aprovado com o cliente parado na etapa errada.
 *
 * E se a empresa não tiver etapa com aquele marco, o orçamento é criado ou
 * aprovado do mesmo jeito: a automação é conveniência, não requisito.
 */
@Injectable()
export class OrcamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly funil: FunilService,
  ) {}

  async listar(query: OrcamentosQuery): Promise<Paginado<Orcamento>> {
    const where: Prisma.OrcamentoWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.clienteId) where.clienteId = query.clienteId;

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.orcamento.findMany({
          where,
          include: INCLUDE_PADRAO,
          orderBy: { criadoEm: 'desc' },
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.orcamento.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => this.paraResposta(registro)),
      total,
      query,
    );
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
        include: INCLUDE_PADRAO,
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
      await garantirVinculos(tx, dados);

      const criado = await tx.orcamento.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          descricao: dados.descricao,
          valor: dados.valor,
          validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
        },
        include: INCLUDE_PADRAO,
      });

      // Quem recebeu proposta está em negociação: o funil reflete isso sozinho.
      await this.funil.moverParaMarco(tx, dados.clienteId, 'orcamento_enviado');

      return criado;
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
    const orcamento = await this.prisma.comTenant(async (tx) => {
      const atual = await this.exigir(tx, id);

      if (atual.status !== 'aberto') {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Este orçamento está ${ROTULO_STATUS[atual.status].toLowerCase()} e não pode mais ser alterado. Para mudar o combinado, emita um novo.`,
        });
      }

      await garantirVinculos(tx, dados);

      return tx.orcamento.update({
        where: { id },
        data: {
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          descricao: dados.descricao,
          valor: dados.valor,
          validoAte: dados.validoAte ? new Date(dados.validoAte) : null,
        },
        include: INCLUDE_PADRAO,
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
    const orcamento = await this.prisma.comTenant(async (tx) => {
      const atual = await this.exigir(tx, id);
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

      const atualizado = await tx.orcamento.update({
        where: { id },
        data: {
          status: novoStatus,
          // Registra quando o cliente respondeu; reabrir limpa a marca, porque
          // a resposta anterior deixou de valer.
          respondidoEm: novoStatus === 'aberto' ? null : new Date(),
        },
        include: INCLUDE_PADRAO,
      });

      // Venda fechada move o cliente para a etapa de fechamento. Recusar não
      // move nada: a negociação pode continuar, e tirar a pessoa do lugar
      // esconderia justamente o que precisa de atenção.
      if (novoStatus === 'aprovado') {
        await this.funil.moverParaMarco(tx, atualizado.clienteId, 'fechado');
      }

      return atualizado;
    });

    return this.paraResposta(orcamento);
  }

  async remover(id: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const atual = await this.exigir(tx, id);

      if (atual.status === 'aprovado') {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem:
            'Orçamento aprovado não pode ser excluído — ele faz parte do histórico do cliente e do financeiro.',
        });
      }

      await tx.orcamento.deleteMany({ where: { id } });
    });
  }

  /** Carrega o orçamento dentro de uma transação já aberta, ou devolve 404. */
  private async exigir(tx: TransacaoComTenant, id: string): Promise<OrcamentoBanco> {
    const orcamento = await tx.orcamento.findUnique({ where: { id }, include: INCLUDE_PADRAO });

    if (!orcamento) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Orçamento não encontrado.',
      });
    }

    return orcamento;
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
