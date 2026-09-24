import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CAMPO_ARMADILHA,
  ORIGEM_FORMULARIO,
  type ChaveMarketing,
  type DesempenhoDaOrigem,
  type LeadPublicoInput,
  type MarketingQuery,
  type OcupacaoDaEtapa,
  type RelatorioMarketing,
} from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { ClientesService } from '../crm/clientes/clientes.service';

/**
 * Marketing — módulo beta (arquitetura §8.3).
 *
 * Duas coisas: de onde os leads vêm e quanto cada origem converte, mais a
 * chave do formulário que o assinante cola no próprio site.
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

  /** Leads por origem e ocupação do funil, no período. */
  async relatorio(query: MarketingQuery): Promise<RelatorioMarketing> {
    const de = new Date(`${query.de}T00:00:00.000Z`);
    const ate = new Date(`${query.ate}T23:59:59.999Z`);

    const [porOrigem, aprovados, etapas] = await this.prisma.comTenant(async (tx) => {
      const porOrigem = await tx.cliente.groupBy({
        by: ['origem'],
        where: { anonimizadoEm: null, criadoEm: { gte: de, lte: ate } },
        _count: { _all: true },
      });

      // A conversão é medida por orçamento aprovado, e não por etapa do funil:
      // etapa é posição, que alguém move à mão; orçamento aprovado é fato.
      const aprovados = await tx.orcamento.findMany({
        where: {
          status: 'aprovado',
          cliente: { anonimizadoEm: null, criadoEm: { gte: de, lte: ate } },
        },
        select: { valor: true, clienteId: true, cliente: { select: { origem: true } } },
      });

      const etapas = await tx.etapaFunil.findMany({
        orderBy: { ordem: 'asc' },
        select: {
          id: true,
          nome: true,
          ordem: true,
          _count: { select: { clientes: true } },
        },
      });

      return [porOrigem, aprovados, etapas] as const;
    });

    // Um cliente com dois orçamentos aprovados é **um** convertido, e duas
    // receitas. Contar linhas de orçamento daria uma taxa acima de 100%.
    const convertidosPorOrigem = new Map<string | null, Set<string>>();
    const receitaPorOrigem = new Map<string | null, Prisma.Decimal>();

    for (const orcamento of aprovados) {
      const origem = orcamento.cliente.origem;

      const clientes = convertidosPorOrigem.get(origem) ?? new Set<string>();
      clientes.add(orcamento.clienteId);
      convertidosPorOrigem.set(origem, clientes);

      const receita = receitaPorOrigem.get(origem) ?? new Prisma.Decimal(0);
      receitaPorOrigem.set(origem, receita.plus(orcamento.valor));
    }

    const origens: DesempenhoDaOrigem[] = porOrigem
      .map((grupo) => {
        const leads = grupo._count._all;
        const convertidos = convertidosPorOrigem.get(grupo.origem)?.size ?? 0;

        return {
          origem: grupo.origem,
          leads,
          convertidos,
          taxaConversao: leads === 0 ? 0 : convertidos / leads,
          receita: (receitaPorOrigem.get(grupo.origem) ?? new Prisma.Decimal(0)).toFixed(2),
        };
      })
      .sort((a, b) => b.leads - a.leads);

    const ocupacao: OcupacaoDaEtapa[] = etapas.map((etapa) => ({
      etapaId: etapa.id,
      etapa: etapa.nome,
      ordem: etapa.ordem,
      clientes: etapa._count.clientes,
    }));

    return {
      origens,
      etapas: ocupacao,
      totalLeads: origens.reduce((soma, item) => soma + item.leads, 0),
      periodo: { de: query.de, ate: query.ate },
    };
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
