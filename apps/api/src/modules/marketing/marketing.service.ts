import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CAMPO_ARMADILHA,
  DIAS_PARA_SERIE_MENSAL,
  ORIGEM_FORMULARIO,
  type ChaveMarketing,
  type DesempenhoDaCampanha,
  type Granularidade,
  type LeadPublicoInput,
  type MarketingQuery,
  type OcupacaoDaEtapa,
  type RelatorioMarketing,
  type SerieDeLeads,
} from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { ClientesService } from '../crm/clientes/clientes.service';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Marcador de "campo vazio" nas chaves de agrupamento.
 *
 * `null` não serve como chave de `Map` distinguível de uma string vazia, e o
 * caractere nulo não aparece em texto digitado — então não há como um valor
 * real colidir com este marcador.
 */
const SEM_VALOR = '\u0000vazio';

type LeadDaCoorte = {
  id: string;
  criadoEm: Date;
  origem: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

type ResumoConversao = {
  porCliente: Map<string, { receita: Prisma.Decimal; diasAteFechar: number }>;
  receitaTotal: Prisma.Decimal;
};

type UtmDaCampanha = Pick<
  DesempenhoDaCampanha,
  'utmSource' | 'utmMedium' | 'utmCampaign'
>;

/** Agrupa uma lista por uma chave calculada, preservando a ordem de chegada. */
function agrupar<T>(itens: T[], chaveDe: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();

  for (const item of itens) {
    const chave = chaveDe(item);
    const grupo = grupos.get(chave);

    if (grupo) {
      grupo.push(item);
    } else {
      grupos.set(chave, [item]);
    }
  }

  return grupos;
}

/**
 * Marketing — módulo beta (arquitetura §8.3).
 *
 * De onde os leads vêm, por qual campanha, quando entraram e quanto cada
 * recorte converte — mais a chave do formulário que o assinante cola no
 * próprio site.
 *
 * Não há tabela nova para o relatório. Origem e UTM já são gravados no cliente
 * desde o cadastro, e a conversão é derivada de orçamento aprovado — a mesma
 * decisão das listas de leads e reativação (§6): relatório que lê o estado
 * atual não envelhece, relatório que mantém contagem própria sim.
 */
@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
  ) {}

  /**
   * O desempenho de marketing do período.
   *
   * ## Tudo é a mesma coorte
   *
   * Todos os blocos falam dos **leads que entraram no período**: de onde
   * vieram, por qual campanha, quando entraram, quantos converteram e onde
   * estão hoje. Manter uma coorte só é o que permite comparar os blocos entre
   * si — antes a ocupação do funil contava o funil inteiro e não respondia ao
   * filtro, então metade do relatório mudava com a data e a outra metade não.
   *
   * ## A conversão é medida por orçamento aprovado
   *
   * E não por etapa do funil: etapa é posição, que alguém move à mão; orçamento
   * aprovado é fato. O orçamento pode ter sido aprovado **depois** do período —
   * é intencional, e é o que torna a medida uma coorte: "dos leads de março,
   * quantos fecharam (a qualquer momento)".
   */
  async relatorio(query: MarketingQuery): Promise<RelatorioMarketing> {
    const de = new Date(`${query.de}T00:00:00.000Z`);
    const ate = new Date(`${query.ate}T23:59:59.999Z`);

    const daCoorte = {
      anonimizadoEm: null,
      criadoEm: { gte: de, lte: ate },
    } as const;

    const [leads, aprovados, etapas, noFunil] = await this.prisma.comTenant(async (tx) =>
      Promise.all([
        // Os leads vêm linha a linha, e não agregados, porque três recortes
        // saem dos mesmos registros: origem, campanha e a série no tempo.
        // Agregar três vezes no banco custaria três varreduras do mesmo
        // conjunto para produzir o que uma leitura já contém.
        tx.cliente.findMany({
          where: daCoorte,
          select: {
            id: true,
            criadoEm: true,
            origem: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
          },
        }),

        tx.orcamento.findMany({
          where: { status: 'aprovado', cliente: daCoorte },
          select: {
            valor: true,
            clienteId: true,
            atualizadoEm: true,
            cliente: { select: { criadoEm: true } },
          },
          // Mais antigo primeiro: o tempo até conversão usa o **primeiro**
          // orçamento aprovado do cliente, não o último.
          orderBy: { atualizadoEm: 'asc' },
        }),

        tx.etapaFunil.findMany({
          orderBy: { ordem: 'asc' },
          select: { id: true, nome: true, ordem: true },
        }),

        tx.clienteFunil.groupBy({
          by: ['etapaId'],
          where: { cliente: daCoorte },
          _count: { _all: true },
        }),
      ]),
    );

    const conversao = this.resumirConversao(aprovados);

    return {
      origens: this.agruparPorOrigem(leads, conversao),
      campanhas: this.agruparPorCampanha(leads, conversao),
      serie: this.montarSerie(leads, conversao, query),
      etapas: this.montarOcupacao(etapas, noFunil),
      totalLeads: leads.length,
      totalConvertidos: conversao.porCliente.size,
      receitaTotal: conversao.receitaTotal.toFixed(2),
      periodo: { de: query.de, ate: query.ate },
    };
  }

  /**
   * Consolida os orçamentos aprovados por cliente.
   *
   * Um cliente com dois orçamentos aprovados é **um** convertido e duas
   * receitas. Contar linhas de orçamento daria taxa de conversão acima de 100%,
   * que é o erro clássico deste relatório.
   */
  private resumirConversao(
    aprovados: {
      valor: Prisma.Decimal;
      clienteId: string;
      atualizadoEm: Date;
      cliente: { criadoEm: Date };
    }[],
  ) {
    const porCliente = new Map<string, { receita: Prisma.Decimal; diasAteFechar: number }>();
    let receitaTotal = new Prisma.Decimal(0);

    for (const orcamento of aprovados) {
      receitaTotal = receitaTotal.plus(orcamento.valor);

      const existente = porCliente.get(orcamento.clienteId);

      if (existente) {
        // Segundo orçamento do mesmo cliente: soma a receita e **mantém** o
        // prazo do primeiro. Os orçamentos vêm ordenados, então o primeiro
        // visto é o mais antigo.
        existente.receita = existente.receita.plus(orcamento.valor);
        continue;
      }

      porCliente.set(orcamento.clienteId, {
        receita: orcamento.valor,
        diasAteFechar: Math.max(
          0,
          Math.round(
            (orcamento.atualizadoEm.getTime() - orcamento.cliente.criadoEm.getTime()) / DIA_MS,
          ),
        ),
      });
    }

    return { porCliente, receitaTotal };
  }

  /** Soma leads, conversão, receita e prazo de um conjunto de clientes. */
  private medir(clientes: { id: string }[], conversao: ResumoConversao) {
    let convertidos = 0;
    let receita = new Prisma.Decimal(0);
    let somaDeDias = 0;

    for (const cliente of clientes) {
      const fechado = conversao.porCliente.get(cliente.id);
      if (!fechado) continue;

      convertidos++;
      receita = receita.plus(fechado.receita);
      somaDeDias += fechado.diasAteFechar;
    }

    return {
      leads: clientes.length,
      convertidos,
      taxaConversao: clientes.length === 0 ? 0 : convertidos / clientes.length,
      receita: receita.toFixed(2),
      // `null`, e não zero: zero dia significaria "fechou no mesmo dia", que é
      // uma informação bem diferente de "ainda não fechou ninguém".
      diasAteConversao: convertidos === 0 ? null : Math.round(somaDeDias / convertidos),
    };
  }

  private agruparPorOrigem(leads: LeadDaCoorte[], conversao: ResumoConversao) {
    const grupos = agrupar(leads, (lead) => lead.origem ?? SEM_VALOR);

    return [...grupos.entries()]
      .map(([chave, clientes]) => ({
        origem: chave === SEM_VALOR ? null : chave,
        ...this.medir(clientes, conversao),
      }))
      .sort((a, b) => b.leads - a.leads);
  }

  /**
   * Agrupa pela combinação dos três UTM.
   *
   * A chave é a tripla, e não só a campanha: o mesmo `natal-2026` rodando no
   * Google e no Instagram são dois investimentos com resultados próprios, e
   * somá-los esconderia qual dos dois vale continuar.
   *
   * Leads sem nenhum UTM ficam de fora — a lista é de campanhas, e uma linha
   * "sem campanha" com metade dos leads só afastaria as que interessam.
   */
  private agruparPorCampanha(
    leads: LeadDaCoorte[],
    conversao: ResumoConversao,
  ): DesempenhoDaCampanha[] {
    const comUtm = leads.filter((lead) => lead.utmSource ?? lead.utmMedium ?? lead.utmCampaign);

    // O grupo guarda a tripla original ao lado dos clientes, em vez de
    // codificá-la na chave e decodificar depois. A versão com chave de texto
    // tinha um defeito difícil de ver: o marcador de campo vazio continha o
    // próprio separador, e o `split` devolvia cinco pedaços embaralhados. Sem
    // ida e volta, não há separador que possa colidir com o conteúdo.
    const grupos = new Map<string, { utm: UtmDaCampanha; clientes: LeadDaCoorte[] }>();

    for (const lead of comUtm) {
      const utm = {
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
      };
      const chave = JSON.stringify(utm);
      const grupo = grupos.get(chave);

      if (grupo) {
        grupo.clientes.push(lead);
      } else {
        grupos.set(chave, { utm, clientes: [lead] });
      }
    }

    return [...grupos.values()]
      .map(({ utm, clientes }) => ({ ...utm, ...this.medir(clientes, conversao) }))
      .sort((a, b) => b.leads - a.leads);
  }

  /**
   * A série de leads ao longo do período.
   *
   * Monta o eixo primeiro e joga os leads dentro, em vez de agrupar o que
   * existe: uma série construída só a partir dos leads omitiria os dias sem
   * nenhum — e "entraram zero leads na terça" é justamente o que o dono precisa
   * ver.
   */
  private montarSerie(
    leads: LeadDaCoorte[],
    conversao: ResumoConversao,
    query: MarketingQuery,
  ): SerieDeLeads {
    const dias =
      Math.round(
        (new Date(`${query.ate}T00:00:00Z`).getTime() -
          new Date(`${query.de}T00:00:00Z`).getTime()) /
          DIA_MS,
      ) + 1;

    const granularidade: Granularidade = dias > DIAS_PARA_SERIE_MENSAL ? 'mes' : 'dia';
    const recortar = (data: Date) => data.toISOString().slice(0, granularidade === 'dia' ? 10 : 7);

    const pontos = new Map<string, { leads: number; convertidos: number }>();

    // O eixo completo, do início ao fim do período.
    const cursor = new Date(`${query.de}T00:00:00Z`);
    const limite = new Date(`${query.ate}T00:00:00Z`);

    while (cursor <= limite) {
      pontos.set(recortar(cursor), { leads: 0, convertidos: 0 });

      if (granularidade === 'dia') {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      } else {
        // Dia 1 antes de avançar: partindo do dia 31, somar um mês pularia
        // fevereiro inteiro e deixaria um buraco no eixo.
        cursor.setUTCDate(1);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    }

    for (const lead of leads) {
      const ponto = pontos.get(recortar(lead.criadoEm));
      if (!ponto) continue;

      ponto.leads++;
      if (conversao.porCliente.has(lead.id)) ponto.convertidos++;
    }

    return {
      granularidade,
      pontos: [...pontos.entries()].map(([quando, valores]) => ({ quando, ...valores })),
    };
  }

  private montarOcupacao(
    etapas: { id: string; nome: string; ordem: number }[],
    noFunil: { etapaId: string; _count: { _all: number } }[],
  ): OcupacaoDaEtapa[] {
    const porEtapa = new Map(noFunil.map((grupo) => [grupo.etapaId, grupo._count._all]));

    // Parte das etapas, e não do agrupamento: etapa sem nenhum lead do período
    // precisa aparecer com zero. Uma etapa que desaparece da lista parece não
    // existir, quando o que ela diz é "ninguém chegou até aqui".
    return etapas.map((etapa) => ({
      etapaId: etapa.id,
      etapa: etapa.nome,
      ordem: etapa.ordem,
      clientes: porEtapa.get(etapa.id) ?? 0,
    }));
  }

  /** A chave atual do formulário, ou `null` se ninguém gerou ainda. */
  async chave(): Promise<ChaveMarketing> {
    const tenant = await this.prisma.comTenant((tx) =>
      tx.tenant.findUnique({
        where: { id: tenantAtual() },
        select: { chaveMarketing: true },
      }),
    );

    return { chave: tenant?.chaveMarketing ?? null };
  }

  /**
   * Gera uma chave nova, substituindo a anterior.
   *
   * Gerar de novo é o botão de "revogar": a chave antiga para de funcionar na
   * hora, e o formulário que ainda a usa passa a ser recusado. É o caminho
   * quando o site do assinante vaza para onde não devia, ou quando alguém
   * começa a despejar lead falso.
   */
  async gerarChave(): Promise<ChaveMarketing> {
    const tenantId = tenantAtual();
    const chave = `${tenantId}.${randomBytes(24).toString('base64url')}`;

    await this.prisma.comTenant((tx) =>
      tx.tenant.update({ where: { id: tenantId }, data: { chaveMarketing: chave } }),
    );

    return { chave };
  }

  /**
   * Recebe um lead do formulário público.
   *
   * Devolve sempre "recebido", inclusive quando descarta o envio. Um endpoint
   * aberto que responde de formas diferentes ensina quem está do outro lado:
   * "chave inválida" confirmaria quais chaves existem, e "armadilha detectada"
   * entregaria a regra a ser contornada. Os descartes ficam no log do servidor,
   * onde servem para diagnóstico sem servir de sonda.
   */
  async receberLead(dados: LeadPublicoInput): Promise<void> {
    // O campo-armadilha fica escondido por CSS: gente não o vê, robô preenche
    // tudo. Descartado em silêncio, como os demais casos.
    if (dados[CAMPO_ARMADILHA]) {
      this.logger.warn('Lead público descartado: campo-armadilha preenchido.');
      return;
    }

    const tenantId = this.tenantDaChave(dados.chave);

    if (!tenantId) {
      this.logger.warn('Lead público recusado: chave com formato inválido.');
      return;
    }

    const confere = await this.chaveConfere(tenantId, dados.chave);

    if (!confere) {
      this.logger.warn(`Lead público recusado: chave não confere para a empresa ${tenantId}.`);
      return;
    }

    await this.clientes.criarPeloFormulario(tenantId, {
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      documento: null,
      // A mensagem do visitante vira observação: é o contexto que a pessoa que
      // for atender precisa ter em mãos.
      observacoes: dados.mensagem,
      origem: dados.origem ?? ORIGEM_FORMULARIO,
      utmSource: dados.utmSource,
      utmMedium: dados.utmMedium,
      utmCampaign: dados.utmCampaign,
      camposPersonalizados: {},
      etiquetas: [],
    });
  }

  /**
   * A empresa dona da chave, lida do próprio valor.
   *
   * A chave carrega o id da empresa no prefixo — o mesmo desenho do refresh
   * token, e pelo mesmo motivo: `tenant` está sob RLS, então procurá-la pela
   * chave exigiria ler a tabela sem contexto. Com o id à mão, o contexto é
   * estabelecido antes da consulta e nenhuma política precisa ser afrouxada.
   */
  private tenantDaChave(chave: string): string | null {
    const [tenantId] = chave.split('.');

    const ehUuid =
      typeof tenantId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);

    return ehUuid ? tenantId : null;
  }

  private async chaveConfere(tenantId: string, chave: string): Promise<boolean> {
    const tenant = await this.prisma.comTenantExplicito(tenantId, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { chaveMarketing: true, status: true },
      }),
    );

    // Empresa cancelada para de receber lead: continuar gravando encheria de
    // dado novo uma conta que está a caminho da exclusão.
    if (!tenant?.chaveMarketing || tenant.status === 'cancelado') {
      return false;
    }

    const gravada = Buffer.from(tenant.chaveMarketing);
    const recebida = Buffer.from(chave);

    // Comparação de tempo constante. O ganho aqui é menor que no login — a
    // chave é pública —, mas o custo também é, e a regra "segredo se compara
    // assim" vale mais consistente do que otimizada caso a caso.
    return gravada.length === recebida.length && timingSafeEqual(gravada, recebida);
  }
}
