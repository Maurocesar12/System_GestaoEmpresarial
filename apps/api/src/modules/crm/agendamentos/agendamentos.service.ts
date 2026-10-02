import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  possuiPermissao,
  ROTULO_ACAO_AGENDAMENTO,
  ROTULO_STATUS_AGENDAMENTO,
  TRANSICOES_AGENDAMENTO,
  acoesAgendamentoDisponiveis,
  estaAtrasado,
  estaPendente,
  type AcaoAgendamento,
  type Agendamento,
  type AgendamentoFormInput,
  type AgendamentosQuery,
  type ItemMaterialInput,
  type Paginado,
  type RecebimentoExecucaoInput,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';
import { garantirVinculos } from '../../../common/vinculos';
import { FinanceiroService } from '../../financeiro/financeiro.service';
import { ComissoesService } from '../../operacao/comissoes/comissoes.service';
import { EstoqueService } from '../../operacao/estoque/estoque.service';

/** Relações que toda resposta de agendamento precisa. */
const INCLUDE_PADRAO = {
  cliente: { select: { nome: true, telefone: true } },
  servico: { select: { nome: true, precoPadrao: true } },
  tecnico: { select: { nome: true } },
  orcamento: { select: { valor: true } },
} as const;

/**
 * O dia do compromisso, em `AAAA-MM-DD`.
 *
 * Um lugar só porque duas gravações dependem dele na execução — o atendimento
 * no histórico e a receita no financeiro — e elas precisam cair no mesmo dia.
 * Se um dia esta regra mudar, as duas mudam juntas.
 */
function diaDoCompromisso(dataHora: Date): string {
  return dataHora.toISOString().slice(0, 10);
}

/** O registro do banco, derivado do schema em vez de redigitado à mão. */
type AgendamentoBanco = Prisma.AgendamentoGetPayload<{ include: typeof INCLUDE_PADRAO }>;

@Injectable()
export class AgendamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
    private readonly comissoes: ComissoesService,
    private readonly financeiro: FinanceiroService,
  ) {}

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

    return paginar(
      registros.map((registro) => this.paraResposta(registro)),
      total,
      query,
    );
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
      await garantirVinculos(tx, dados);

      return tx.agendamento.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          dataHora: new Date(dados.dataHora),
          observacoes: dados.observacoes,
          tecnicoId: dados.tecnicoId,
          orcamentoId: dados.orcamentoId,
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
    const agendamento = await this.prisma.comTenant(async (tx) => {
      const atual = await this.exigir(tx, id);

      if (atual.status === 'executado' || atual.status === 'cancelado') {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Este agendamento está ${ROTULO_STATUS_AGENDAMENTO[
            atual.status
          ].toLowerCase()} e não pode mais ser alterado.`,
        });
      }

      await garantirVinculos(tx, dados);

      return tx.agendamento.update({
        where: { id },
        data: {
          clienteId: dados.clienteId,
          servicoId: dados.servicoId,
          dataHora: new Date(dados.dataHora),
          observacoes: dados.observacoes,
          tecnicoId: dados.tecnicoId,
          orcamentoId: dados.orcamentoId,
        },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(agendamento);
  }

  /**
   * Aplica uma transição da máquina de estados.
   *
   * Marcar como executado fecha o ciclo na mesma transação: registra o
   * atendimento no histórico do cliente, dá baixa nos materiais usados, gera a
   * comissão do técnico e, se pedido, lança a receita. Se qualquer um falhar, o
   * agendamento continua pendente.
   *
   * @param materiais Só vale na execução. Ausente usa a lista padrão do serviço.
   * @param recebimento Só vale na execução. Ausente não lança nada.
   */
  async mudarStatus(
    id: string,
    acao: AcaoAgendamento,
    materiais?: ItemMaterialInput[],
    recebimento?: RecebimentoExecucaoInput,
  ): Promise<Agendamento> {
    const lancarReceita = acao === 'executar' && recebimento !== undefined;

    // Executar pede `agenda.gerenciar`; lançar dinheiro pede `financeiro.criar`.
    // Sem esta checagem, um técnico sem acesso ao financeiro passaria a criar
    // lançamentos por um caminho lateral. Recusar antes de abrir a transação
    // deixa claro o motivo — e nada é executado pela metade.
    if (lancarReceita && !possuiPermissao(exigirContextoTenant(), 'financeiro.criar')) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.SEM_PERMISSAO,
        mensagem:
          'Você pode executar o serviço, mas registrar o recebimento depende de acesso ao financeiro. Execute sem lançar, e quem cuida do financeiro registra depois.',
      });
    }

    const agendamento = await this.prisma.comTenant(async (tx) => {
      const atual = await this.exigir(tx, id);
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

      const atualizado = await tx.agendamento.update({
        where: { id },
        data: { status: novoStatus },
        include: INCLUDE_PADRAO,
      });

      if (novoStatus === 'executado') {
        await this.registrarAtendimento(tx, atualizado);
        await this.estoque.consumirNaExecucao(tx, atualizado, materiais);
        await this.comissoes.gerarExecucao(tx, atualizado);

        if (lancarReceita) {
          const oQue = atualizado.servico?.nome ?? atualizado.observacoes ?? 'Serviço executado';

          await this.financeiro.registrarReceitaDeServico(tx, {
            descricao: `${oQue} · ${atualizado.cliente.nome}`,
            valor: recebimento.valor,
            dia: diaDoCompromisso(atualizado.dataHora),
            servicoId: atualizado.servicoId,
            clienteId: atualizado.clienteId,
            recebimento,
          });
        }
      }

      return atualizado;
    });

    return this.paraResposta(agendamento);
  }

  async remover(id: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const atual = await this.exigir(tx, id);

      if (atual.status === 'executado') {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem:
            'Agendamento executado não pode ser excluído — ele faz parte do histórico do cliente.',
        });
      }

      await tx.agendamento.deleteMany({ where: { id } });
    });
  }

  /**
   * Carrega o agendamento dentro de uma transação já aberta, ou devolve 404.
   *
   * Existe para leitura e escrita ficarem na **mesma** transação. Chamar
   * `buscarPorId` antes do `comTenant` abriria uma transação inteira a mais
   * (`BEGIN` + `set_config` + consulta + `COMMIT`) e ainda deixaria a
   * conferência fora da transação que grava.
   */
  private async exigir(tx: TransacaoComTenant, id: string): Promise<AgendamentoBanco> {
    const agendamento = await tx.agendamento.findUnique({ where: { id }, include: INCLUDE_PADRAO });

    if (!agendamento) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Agendamento não encontrado.',
      });
    }

    return agendamento;
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
        data: new Date(diaDoCompromisso(agendamento.dataHora)),
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
      tecnicoId: registro.tecnicoId,
      tecnicoNome: registro.tecnico?.nome ?? null,
      orcamentoId: registro.orcamentoId,
      orcamentoValor: registro.orcamento?.valor.toFixed(2) ?? null,
      // O combinado com o cliente vale mais que o preço de tabela: se houve
      // orçamento, foi aquele valor que ele aceitou pagar.
      valorSugerido:
        registro.orcamento?.valor.toFixed(2) ?? registro.servico?.precoPadrao?.toFixed(2) ?? null,
      criadoEm: registro.criadoEm.toISOString(),
      // A mesma máquina de estados que `mudarStatus` usa para recusar, e a
      // mesma regra de `atualizar`: a tela só mostra o que esta API aceitaria.
      acoesDisponiveis: acoesAgendamentoDisponiveis(registro.status),
      pendente: estaPendente(registro),
      atrasado: estaAtrasado({
        status: registro.status,
        dataHora: registro.dataHora.toISOString(),
      }),
    };
  }
}
