import { Injectable } from '@nestjs/common';
import {
  DIAS_LEAD_RECENTE,
  DIAS_PARA_REATIVACAO,
  permissoesDoUsuario,
  SEGUNDOS_RECARGA_PAINEL,
  type BlocoAgenda,
  type BlocoComercial,
  type BlocoFinanceiro,
  type BlocoFollowUps,
  type BlocoFunil,
  type BlocoLeads,
  type BlocoReativacao,
  type EventoDoPainel,
  type PainelTempoReal,
  type Permissao,
} from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { exigirContextoTenant } from '../../infra/tenant/tenant-context';
import { contarMotivos, LeadsService } from '../crm/leads/leads.service';
import { ZERO } from '../financeiro/decimal';
import {
  MS_POR_DIA,
  Momentos,
  calcularMomentos,
  entidadesVisiveis,
  montarAlertas,
  valorDoTipo,
  resumirSerie,
} from './calculos-painel';

/**
 * Quantos clientes frios o painel analisa por atualização.
 *
 * Bem menos que a tela de reativação: aqui só cabem cinco nomes, e esta
 * consulta roda a cada ciclo de recarga de cada pessoa com o painel aberto. O
 * total, esse sim, continua vindo do `count` — é ele que aparece no cartão.
 */
const CANDIDATOS_FRIOS_NO_PAINEL = 60;

/**
 * Quantos itens cabem nos cartões de leads e de reativação.
 *
 * Os dois deixaram de ter tela própria: o cartão **é** a fila, e não uma amostra
 * com link para o resto. Seis é o que cabe sem esticar a coluna além dos outros
 * blocos do painel — o suficiente para a fila de um dia de trabalho, que é o
 * horizonte real de quem abre a tela de manhã.
 */
const ITENS_DO_CARTAO = 6;

/**
 * Painel em tempo real.
 *
 * ## Uma transação, um instante
 *
 * A tela inicial buscava doze coisas em doze requisições. Funcionava para uma
 * carga por sessão, mas não para uma tela que se atualiza sozinha: seriam doze
 * idas à API por ciclo, cada uma com a própria transação, e números de
 * instantes diferentes lado a lado. Aqui tudo sai de uma transação só, e o
 * instante vai carimbado em `geradoEm`.
 *
 * ## Permissão decide o que é lido, não o que é escondido
 *
 * Cada bloco só é **consultado** se o usuário puder vê-lo (§9.5). O dado de
 * quem não pode ver não trafega e nem chega a sair do banco — esconder na tela
 * o que a API já mandou seria proteção de fachada.
 */
@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
  ) {}

  async tempoReal(): Promise<PainelTempoReal> {
    const contexto = exigirContextoTenant();
    const permissoes = permissoesDoUsuario(contexto.papel, contexto.permissoes);
    const pode = (permissao: Permissao) => permissoes.includes(permissao);

    const agora = new Date();
    const momentos = calcularMomentos(agora);

    const dados = await this.prisma.comTenant(async (tx) => {
      const [
        totalClientes,
        leads,
        funil,
        comercial,
        agenda,
        followUps,
        reativacao,
        financeiro,
        atividade,
      ] = await Promise.all([
        tx.cliente.count({ where: { anonimizadoEm: null } }),
        pode('clientes.visualizar') ? this.montarLeads(tx, agora) : null,
        pode('funil.visualizar') ? this.montarFunil(tx, momentos) : null,
        pode('orcamentos.visualizar') ? this.montarComercial(tx, momentos) : null,
        pode('agenda.visualizar') ? this.montarAgenda(tx, momentos) : null,
        pode('lembretes.visualizar') ? this.montarFollowUps(tx, agora, momentos) : null,
        pode('clientes.visualizar') ? this.montarReativacao(tx, agora) : null,
        pode('financeiro.visualizar') ? this.montarFinanceiro(tx, momentos) : null,
        this.montarAtividade(tx, permissoes),
      ]);

      return {
        totalClientes,
        leads,
        funil,
        comercial,
        agenda,
        followUps,
        reativacao,
        financeiro,
        atividade,
      };
    });

    return {
      geradoEm: agora.toISOString(),
      recarregarEmSegundos: SEGUNDOS_RECARGA_PAINEL,
      alertas: montarAlertas(dados),
      ...dados,
    };
  }

  private async montarLeads(tx: TransacaoComTenant, agora: Date): Promise<BlocoLeads> {
    const [resumo, ultimos] = await Promise.all([
      this.leads.resumirEntrada(tx, agora, DIAS_LEAD_RECENTE),
      this.leads.ultimosLeads(tx, agora, DIAS_LEAD_RECENTE, ITENS_DO_CARTAO),
    ]);

    return {
      hoje: resumo.hoje,
      ontem: resumo.ontem,
      seteDias: resumo.seteDias,
      noPeriodo: resumo.noPeriodo,
      aguardandoContato: resumo.aguardandoContato,
      semContatoNoPrazo: resumo.semContatoNoPrazo,
      comProposta: resumo.comProposta,
      ganhos: resumo.ganhos,
      // Quem já foi atendido mas ainda não recebeu proposta nem fechou.
      emContato: Math.max(
        0,
        resumo.noPeriodo - resumo.aguardandoContato - resumo.comProposta - resumo.ganhos,
      ),
      valorEmProposta: resumo.valorEmProposta,
      porOrigem: resumo.porOrigem,
      ultimos: ultimos.map((lead) => ({
        id: lead.id,
        nome: lead.nome,
        origem: lead.origem,
        criadoEm: lead.criadoEm,
        situacao: lead.situacao,
        horasAteContato: lead.horasAteContato,
        telefone: lead.telefone,
      })),
    };
  }

  /**
   * O funil em três consultas, todas limitadas.
   *
   * O valor por etapa sai dos **orçamentos abertos**, e não das posições do
   * funil: propostas em aberto são dezenas mesmo numa empresa movimentada,
   * enquanto as posições acompanham a carteira inteira. Carregar as posições
   * para somar valor faria o painel ficar mais pesado a cada cliente novo.
   */
  private async montarFunil(tx: TransacaoComTenant, momentos: Momentos): Promise<BlocoFunil> {
    const [etapas, porEtapa, abertos, foraDoFunil, paradas] = await Promise.all([
      tx.etapaFunil.findMany({ orderBy: { ordem: 'asc' }, select: { id: true, nome: true } }),
      tx.clienteFunil.groupBy({ by: ['etapaId'], _count: { _all: true } }),
      tx.orcamento.findMany({
        where: { status: 'aberto' },
        select: {
          valor: true,
          cliente: { select: { posicaoFunil: { select: { etapaId: true } } } },
        },
      }),
      tx.cliente.count({ where: { posicaoFunil: { is: null }, anonimizadoEm: null } }),
      tx.clienteFunil.findMany({
        where: { atualizadoEm: { lt: momentos.corteParado } },
        orderBy: { atualizadoEm: 'asc' },
        take: 5,
        select: {
          atualizadoEm: true,
          etapa: { select: { nome: true } },
          cliente: {
            select: {
              id: true,
              nome: true,
              orcamentos: {
                where: { status: 'aberto' },
                select: { valor: true },
                orderBy: { criadoEm: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const valorPorEtapa = new Map<string, Prisma.Decimal>();
    for (const orcamento of abertos) {
      const etapaId = orcamento.cliente.posicaoFunil?.etapaId;
      if (!etapaId) continue;
      valorPorEtapa.set(etapaId, (valorPorEtapa.get(etapaId) ?? ZERO).plus(orcamento.valor));
    }

    const contagem = new Map(porEtapa.map((grupo) => [grupo.etapaId, grupo._count._all]));

    return {
      total: porEtapa.reduce((soma, grupo) => soma + grupo._count._all, 0),
      foraDoFunil,
      etapas: etapas.map((etapa) => ({
        id: etapa.id,
        nome: etapa.nome,
        clientes: contagem.get(etapa.id) ?? 0,
        valor: (valorPorEtapa.get(etapa.id) ?? ZERO).toFixed(2),
      })),
      paradas: paradas.map((posicao) => ({
        clienteId: posicao.cliente.id,
        nome: posicao.cliente.nome,
        etapa: posicao.etapa.nome,
        dias: Math.floor((Date.now() - posicao.atualizadoEm.getTime()) / MS_POR_DIA),
        valor: posicao.cliente.orcamentos[0]?.valor.toFixed(2) ?? null,
      })),
    };
  }

  private async montarComercial(
    tx: TransacaoComTenant,
    momentos: Momentos,
  ): Promise<BlocoComercial> {
    const [abertos, doMes, ticket, vencendo] = await Promise.all([
      tx.orcamento.aggregate({
        where: { status: 'aberto' },
        _count: { _all: true },
        _sum: { valor: true },
      }),
      tx.orcamento.groupBy({
        by: ['status'],
        where: { respondidoEm: { gte: momentos.inicioDoMes } },
        _count: { _all: true },
        _sum: { valor: true },
      }),
      tx.orcamento.aggregate({ where: { status: 'aprovado' }, _avg: { valor: true } }),
      tx.orcamento.findMany({
        where: { status: 'aberto', validoAte: { not: null, lte: momentos.limiteVencimento } },
        orderBy: { validoAte: 'asc' },
        take: 5,
        select: {
          id: true,
          valor: true,
          validoAte: true,
          cliente: { select: { nome: true } },
        },
      }),
    ]);

    const aprovados = doMes.find((grupo) => grupo.status === 'aprovado');
    const recusados = doMes.find((grupo) => grupo.status === 'recusado');
    const respondidos = (aprovados?._count._all ?? 0) + (recusados?._count._all ?? 0);

    return {
      abertos: {
        quantidade: abertos._count._all,
        valor: (abertos._sum.valor ?? ZERO).toFixed(2),
      },
      aprovadosMes: {
        quantidade: aprovados?._count._all ?? 0,
        valor: (aprovados?._sum.valor ?? ZERO).toFixed(2),
      },
      recusadosMes: {
        quantidade: recusados?._count._all ?? 0,
        valor: (recusados?._sum.valor ?? ZERO).toFixed(2),
      },
      // Sobre os **respondidos**, e não sobre o total emitido: incluir as
      // propostas que ainda estão em aberto no denominador faria a taxa cair
      // toda vez que a equipe trabalhasse mais.
      taxaConversaoMes: respondidos === 0 ? 0 : (aprovados?._count._all ?? 0) / respondidos,
      ticketMedio: (ticket._avg.valor ?? ZERO).toFixed(2),
      vencendo: vencendo.map((orcamento) => ({
        id: orcamento.id,
        clienteNome: orcamento.cliente.nome,
        valor: orcamento.valor.toFixed(2),
        validoAte: orcamento.validoAte!.toISOString().slice(0, 10),
        diasRestantes: Math.ceil(
          (orcamento.validoAte!.getTime() - momentos.hojeUtc.getTime()) / MS_POR_DIA,
        ),
      })),
    };
  }

  private async montarAgenda(tx: TransacaoComTenant, momentos: Momentos): Promise<BlocoAgenda> {
    // Agendado e confirmado são os dois estados em que o compromisso ainda vai
    // acontecer. Executado e cancelado já se resolveram e não pertencem a um
    // painel do que está por vir.
    const ativos: Prisma.AgendamentoWhereInput = {
      status: { in: ['agendado', 'confirmado'] },
    };

    const [hoje, atrasados, amanha, semana] = await Promise.all([
      tx.agendamento.findMany({
        where: { ...ativos, dataHora: { gte: momentos.inicioDeHoje, lt: momentos.inicioDeAmanha } },
        orderBy: { dataHora: 'asc' },
        take: 6,
        select: {
          id: true,
          dataHora: true,
          status: true,
          cliente: { select: { nome: true } },
          servico: { select: { nome: true } },
        },
      }),
      tx.agendamento.count({ where: { ...ativos, dataHora: { lt: momentos.agora } } }),
      tx.agendamento.count({
        where: {
          ...ativos,
          dataHora: { gte: momentos.inicioDeAmanha, lt: momentos.fimDeAmanha },
        },
      }),
      tx.agendamento.count({
        where: { ...ativos, dataHora: { gte: momentos.agora, lt: momentos.daquiSeteDias } },
      }),
    ]);

    return {
      hoje: hoje.map((agendamento) => ({
        id: agendamento.id,
        clienteNome: agendamento.cliente.nome,
        servicoNome: agendamento.servico?.nome ?? null,
        dataHora: agendamento.dataHora.toISOString(),
        status: agendamento.status,
      })),
      atrasados,
      amanha,
      seteDias: semana,
    };
  }

  private async montarFollowUps(
    tx: TransacaoComTenant,
    agora: Date,
    momentos: Momentos,
  ): Promise<BlocoFollowUps> {
    const [pendentes, atrasados, falhas, proximos] = await Promise.all([
      tx.lembreteFollowUp.count({ where: { status: 'pendente' } }),
      tx.lembreteFollowUp.count({ where: { status: 'pendente', dataEnvio: { lt: agora } } }),
      tx.lembreteFollowUp.count({
        where: { status: 'falhou', criadoEm: { gte: momentos.seteDiasAtras } },
      }),
      tx.lembreteFollowUp.findMany({
        where: { status: 'pendente' },
        orderBy: { dataEnvio: 'asc' },
        take: 5,
        select: {
          id: true,
          canal: true,
          dataEnvio: true,
          clienteId: true,
          cliente: { select: { nome: true } },
        },
      }),
    ]);

    return {
      pendentes,
      atrasados,
      falhasRecentes: falhas,
      proximos: proximos.map((lembrete) => ({
        id: lembrete.id,
        clienteId: lembrete.clienteId,
        clienteNome: lembrete.cliente.nome,
        canal: lembrete.canal,
        dataEnvio: lembrete.dataEnvio.toISOString(),
      })),
    };
  }

  private async montarReativacao(tx: TransacaoComTenant, agora: Date): Promise<BlocoReativacao> {
    const corte = new Date(agora.getTime() - DIAS_PARA_REATIVACAO * MS_POR_DIA);

    const { total, clientes } = await this.leads.ranquearFrios(tx, {
      corte,
      agora,
      limite: CANDIDATOS_FRIOS_NO_PAINEL,
    });

    return {
      total,
      diasSemContato: DIAS_PARA_REATIVACAO,
      analisados: clientes.length,
      valorHistorico: clientes
        .reduce((soma, cliente) => soma.plus(cliente.valorHistorico), ZERO)
        .toFixed(2),
      porMotivo: contarMotivos(clientes),
      principais: clientes.slice(0, ITENS_DO_CARTAO).map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        motivo: cliente.motivo,
        diasSemContato: cliente.diasSemContato,
        valorHistorico: cliente.valorHistorico,
        telefone: cliente.telefone,
      })),
    };
  }

  /**
   * Caixa do mês, contas em aberto e a série dos últimos meses.
   *
   * A série é somada em memória a partir de três colunas — tipo, valor e data
   * de pagamento. A alternativa seria um `groupBy` por mês, seis consultas para
   * seis meses; a tela antiga fazia exatamente isso, em seis **requisições**.
   */
  private async montarFinanceiro(
    tx: TransacaoComTenant,
    momentos: Momentos,
  ): Promise<BlocoFinanceiro> {
    const daEmpresa = { natureza: 'empresa' as const };
    const emAberto = { ...daEmpresa, pagoEm: null };
    const vencido = { ...emAberto, vencimento: { lt: momentos.hojeUtc } };

    const [doMes, abertos, aPagarVencido, aReceberVencido, pagos] = await Promise.all([
      tx.lancamentoFinanceiro.groupBy({
        by: ['tipo'],
        where: { ...daEmpresa, pagoEm: { gte: momentos.inicioDoMesUtc, lte: momentos.hojeUtc } },
        _sum: { valor: true },
      }),
      tx.lancamentoFinanceiro.groupBy({ by: ['tipo'], where: emAberto, _sum: { valor: true } }),
      tx.lancamentoFinanceiro.aggregate({
        where: { ...vencido, tipo: 'saida' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      tx.lancamentoFinanceiro.aggregate({
        where: { ...vencido, tipo: 'entrada' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      tx.lancamentoFinanceiro.findMany({
        where: { ...daEmpresa, pagoEm: { gte: momentos.inicioDaSerieUtc, lte: momentos.hojeUtc } },
        select: { tipo: true, valor: true, pagoEm: true },
      }),
    ]);

    const entradasMes = valorDoTipo(doMes, 'entrada');
    const saidasMes = valorDoTipo(doMes, 'saida');

    const porMes = new Map<string, { entradas: Prisma.Decimal; saidas: Prisma.Decimal }>();
    for (const chave of momentos.mesesDaSerie) {
      porMes.set(chave, { entradas: ZERO, saidas: ZERO });
    }

    for (const lancamento of pagos) {
      const chave = lancamento.pagoEm!.toISOString().slice(0, 7);
      const mes = porMes.get(chave);
      if (!mes) continue;

      if (lancamento.tipo === 'entrada') mes.entradas = mes.entradas.plus(lancamento.valor);
      else mes.saidas = mes.saidas.plus(lancamento.valor);
    }

    return {
      entradasMes: entradasMes.toFixed(2),
      saidasMes: saidasMes.toFixed(2),
      saldoMes: entradasMes.minus(saidasMes).toFixed(2),
      aReceber: valorDoTipo(abertos, 'entrada').toFixed(2),
      aPagar: valorDoTipo(abertos, 'saida').toFixed(2),
      vencidosAPagar: {
        quantidade: aPagarVencido._count._all,
        valor: (aPagarVencido._sum.valor ?? ZERO).toFixed(2),
      },
      vencidosAReceber: {
        quantidade: aReceberVencido._count._all,
        valor: (aReceberVencido._sum.valor ?? ZERO).toFixed(2),
      },
      ...resumirSerie(porMes),
    };
  }

  /**
   * O que aconteceu nos últimos minutos, filtrado pelo que a pessoa pode ver.
   *
   * O histórico inteiro é de `admin` (§9.5), mas negar o feed a todo mundo
   * tiraria do painel justamente a parte que responde "o que está acontecendo
   * agora". A saída é filtrar por **entidade**: cada evento aparece só para
   * quem poderia abrir o registro que o gerou. Quem não pode ver dinheiro não
   * recebe os eventos do financeiro — nem o resumo deles, que costuma trazer o
   * valor no texto.
   */
  private async montarAtividade(
    tx: TransacaoComTenant,
    permissoes: Permissao[],
  ): Promise<EventoDoPainel[]> {
    const entidades = entidadesVisiveis(permissoes);

    if (entidades.length === 0) return [];

    const logs = await tx.logAuditoria.findMany({
      where: { entidade: { in: entidades } },
      orderBy: { criadoEm: 'desc' },
      take: 8,
    });

    const ids = [...new Set(logs.flatMap((log) => (log.usuarioId ? [log.usuarioId] : [])))];
    const usuarios = ids.length
      ? await tx.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
      : [];
    const nomes = new Map(usuarios.map((usuario) => [usuario.id, usuario.nome]));

    return logs.map((log) => ({
      id: log.id,
      quando: log.criadoEm.toISOString(),
      usuarioNome: log.usuarioId ? (nomes.get(log.usuarioId) ?? 'Usuário removido') : 'Sistema',
      acao: log.acao,
      entidade: log.entidade,
      entidadeId: log.entidadeId,
      resumo: log.resumo ?? `${log.acao} ${log.entidade}`,
    }));
  }
}
