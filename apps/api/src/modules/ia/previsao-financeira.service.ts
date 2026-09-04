import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  CODIGOS_ERRO,
  type ConsumoIaResponse,
  type GerarPrevisaoFinanceiraInput,
  type MesFinanceiro,
  type MesProjetado,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import type { Env } from '../../config/env.schema';
import { Prisma } from '../../generated/prisma/client';
import { AssistenteIa } from '../../infra/ia/assistente-ia';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../infra/tenant/tenant-context';
import { AuditoriaService } from '../plataforma/auditoria/auditoria.service';

interface DadosCalculados {
  saldoAtual: string;
  historico: MesFinanceiro[];
  projecoes: MesProjetado[];
}

@Injectable()
export class PrevisaoFinanceiraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assistente: AssistenteIa,
    private readonly config: ConfigService<Env, true>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async ultima(): Promise<PrevisaoFinanceiraResponse | null> {
    const inicio = inicioMes(new Date());
    const dados = await this.prisma.comTenant(async (tx) => {
      const [previsao, tenant, usado] = await Promise.all([
        tx.previsaoFinanceira.findFirst({
          where: { modelo: { not: 'processando' } },
          orderBy: { criadoEm: 'desc' },
        }),
        tx.tenant.findUniqueOrThrow({ where: { id: tenantAtual() }, include: { plano: true } }),
        tx.previsaoFinanceira.count({
          where: { criadoEm: { gte: inicio }, modelo: { not: 'processando' } },
        }),
      ]);
      return { previsao, limite: tenant.plano.limitePrevisoesIaMensais, usado };
    });
    if (!dados.previsao) return null;

    const base = dados.previsao.dadosBase as unknown as DadosCalculados;
    return {
      id: dados.previsao.id,
      geradoEm: dados.previsao.criadoEm.toISOString(),
      modo: dados.previsao.modo,
      modelo: dados.previsao.modelo,
      aviso:
        'Estimativa baseada nos lançamentos registrados. Não é garantia de resultado nem aconselhamento contábil.',
      historico: base.historico,
      projecoes: base.projecoes,
      analise: dados.previsao.resultado as unknown as PrevisaoFinanceiraResponse['analise'],
      consumo: {
        inputTokens: dados.previsao.inputTokens,
        outputTokens: dados.previsao.outputTokens,
        custoEstimadoUsd: dados.previsao.custoEstimadoUsd.toFixed(6),
      },
      quota: { usado: dados.usado, limite: dados.limite },
    };
  }

  async consumoDoMes(): Promise<ConsumoIaResponse> {
    const inicio = inicioMes(new Date());
    const registros = await this.prisma.comTenant(async (tx) => {
      const previsoes = await tx.previsaoFinanceira.findMany({
        where: { criadoEm: { gte: inicio }, modelo: { not: 'processando' } },
        select: {
          usuarioId: true,
          inputTokens: true,
          outputTokens: true,
          custoEstimadoUsd: true,
        },
      });
      const ids = [...new Set(previsoes.map((item) => item.usuarioId))];
      const usuarios = await tx.usuario.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true },
      });
      return { previsoes, nomes: new Map(usuarios.map((item) => [item.id, item.nome])) };
    });

    const agrupado = new Map<
      string,
      {
        usuarioNome: string;
        previsoes: number;
        inputTokens: number;
        outputTokens: number;
        custo: number;
      }
    >();
    for (const item of registros.previsoes) {
      const atual = agrupado.get(item.usuarioId) ?? {
        usuarioNome: registros.nomes.get(item.usuarioId) ?? 'Usuário removido',
        previsoes: 0,
        inputTokens: 0,
        outputTokens: 0,
        custo: 0,
      };
      atual.previsoes += 1;
      atual.inputTokens += item.inputTokens;
      atual.outputTokens += item.outputTokens;
      atual.custo += Number(item.custoEstimadoUsd);
      agrupado.set(item.usuarioId, atual);
    }

    const porUsuario = [...agrupado.entries()].map(([usuarioId, item]) => ({
      usuarioId,
      usuarioNome: item.usuarioNome,
      previsoes: item.previsoes,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      custoEstimadoUsd: item.custo.toFixed(6),
    }));
    return {
      periodo: chaveMes(inicio),
      totalPrevisoes: registros.previsoes.length,
      inputTokens: porUsuario.reduce((total, item) => total + item.inputTokens, 0),
      outputTokens: porUsuario.reduce((total, item) => total + item.outputTokens, 0),
      custoEstimadoUsd: porUsuario
        .reduce((total, item) => total + Number(item.custoEstimadoUsd), 0)
        .toFixed(6),
      porUsuario,
    };
  }

  async gerar(dados: GerarPrevisaoFinanceiraInput): Promise<PrevisaoFinanceiraResponse> {
    const tenantId = tenantAtual();
    const usuarioId = exigirContextoTenant().usuarioId;
    const calculados = await this.calcular(dados);
    const reserva = await this.reservar(tenantId, usuarioId, dados, calculados);
    const identificadorSeguro = createHash('sha256')
      .update(`${tenantId}:${usuarioId}`)
      .digest('hex');
    const resultado = await this.assistente.analisarPrevisao({
      identificadorSeguro,
      saldoAtual: calculados.saldoAtual,
      historico: calculados.historico,
      projecoes: calculados.projecoes,
    });
    const custo =
      (resultado.inputTokens * this.config.get('OPENAI_CUSTO_INPUT_USD_MILHAO', { infer: true }) +
        resultado.outputTokens *
          this.config.get('OPENAI_CUSTO_OUTPUT_USD_MILHAO', { infer: true })) /
      1_000_000;

    const salvo = await this.prisma.comTenant(async (tx) => {
      const previsao = await tx.previsaoFinanceira.update({
        where: { id: reserva.id },
        data: {
          modo: resultado.modo,
          modelo: resultado.modelo,
          resultado: resultado.analise as unknown as Prisma.InputJsonValue,
          inputTokens: resultado.inputTokens,
          outputTokens: resultado.outputTokens,
          custoEstimadoUsd: new Prisma.Decimal(custo),
        },
      });
      await this.auditoria.registrar(tx, {
        entidade: 'previsao_financeira',
        entidadeId: previsao.id,
        acao: 'criou',
        depois: { modo: resultado.modo, modelo: resultado.modelo },
      });
      return previsao;
    });

    return {
      id: salvo.id,
      geradoEm: salvo.criadoEm.toISOString(),
      modo: resultado.modo,
      modelo: resultado.modelo,
      aviso:
        'Estimativa baseada nos lançamentos registrados. Não é garantia de resultado nem aconselhamento contábil.',
      historico: calculados.historico,
      projecoes: calculados.projecoes,
      analise: resultado.analise,
      consumo: {
        inputTokens: resultado.inputTokens,
        outputTokens: resultado.outputTokens,
        custoEstimadoUsd: custo.toFixed(6),
      },
      quota: { usado: reserva.usado, limite: reserva.limite },
    };
  }

  private async reservar(
    tenantId: string,
    usuarioId: string,
    dados: GerarPrevisaoFinanceiraInput,
    calculados: DadosCalculados,
  ): Promise<{ id: string; usado: number; limite: number | null }> {
    const inicioDoMes = inicioMes(new Date());
    // Uma geração em andamento ocupa cota para impedir cliques concorrentes de
    // ultrapassarem o limite. Se o processo cair, a reserva envelhece em dez
    // minutos e deixa de bloquear novas previsões.
    const processandoDesde = new Date(Date.now() - 10 * 60 * 1000);
    return this.prisma.comTenant(async (tx) => {
      await tx.$executeRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: { plano: true },
      });
      if (!tenant.plano.iaHabilitada) {
        throw new ForbiddenException({
          codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
          mensagem: 'A previsão com IA está disponível no plano Pro.',
        });
      }
      const usado = await tx.previsaoFinanceira.count({
        where: {
          criadoEm: { gte: inicioDoMes },
          OR: [
            { modelo: { not: 'processando' } },
            { modelo: 'processando', criadoEm: { gte: processandoDesde } },
          ],
        },
      });
      const limite = tenant.plano.limitePrevisoesIaMensais;
      if (limite !== null && usado >= limite) {
        throw new ForbiddenException({
          codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
          mensagem: 'O limite mensal de previsões do plano foi atingido.',
        });
      }
      const previsao = await tx.previsaoFinanceira.create({
        data: {
          tenantId,
          usuarioId,
          mesesHistorico: dados.mesesHistorico,
          mesesProjecao: dados.mesesProjecao,
          modo: 'demonstracao',
          modelo: 'processando',
          dadosBase: calculados as unknown as Prisma.InputJsonValue,
          resultado: { status: 'processando' },
        },
      });
      return { id: previsao.id, usado: usado + 1, limite };
    });
  }

  private async calcular(dados: GerarPrevisaoFinanceiraInput): Promise<DadosCalculados> {
    const agora = new Date();
    const inicioAtual = inicioMes(agora);
    const inicioHistorico = somarMeses(inicioAtual, -dados.mesesHistorico);
    const inicioProjecao = somarMeses(inicioAtual, 1);
    const fimProjecao = somarMeses(inicioProjecao, dados.mesesProjecao);

    const [pagos, futuros, todasEntradas, todasSaidas] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.lancamentoFinanceiro.findMany({
          where: {
            natureza: 'empresa',
            pagoEm: { gte: inicioHistorico, lt: inicioAtual },
          },
          select: { tipo: true, valor: true, pagoEm: true },
        }),
        tx.lancamentoFinanceiro.findMany({
          where: {
            natureza: 'empresa',
            pagoEm: null,
            OR: [
              { vencimento: { gte: inicioProjecao, lt: fimProjecao } },
              { vencimento: null, data: { gte: inicioProjecao, lt: fimProjecao } },
            ],
          },
          select: { tipo: true, valor: true, vencimento: true, data: true },
        }),
        tx.lancamentoFinanceiro.aggregate({
          where: { natureza: 'empresa', tipo: 'entrada', pagoEm: { not: null } },
          _sum: { valor: true },
        }),
        tx.lancamentoFinanceiro.aggregate({
          where: { natureza: 'empresa', tipo: 'saida', pagoEm: { not: null } },
          _sum: { valor: true },
        }),
      ]),
    );

    const historico = Array.from({ length: dados.mesesHistorico }, (_, indice) => {
      const data = somarMeses(inicioHistorico, indice);
      const chave = chaveMes(data);
      const doMes = pagos.filter((item) => item.pagoEm && chaveMes(item.pagoEm) === chave);
      const entradas = somar(doMes.filter((item) => item.tipo === 'entrada'));
      const saidas = somar(doMes.filter((item) => item.tipo === 'saida'));
      return {
        mes: chave,
        entradas: moeda(entradas),
        saidas: moeda(saidas),
        saldo: moeda(entradas.minus(saidas)),
      };
    });

    const mediaEntradas = mediaPonderada(
      historico.map((item) => new Prisma.Decimal(item.entradas)),
    );
    const mediaSaidas = mediaPonderada(historico.map((item) => new Prisma.Decimal(item.saidas)));
    const saldoAtual = new Prisma.Decimal(todasEntradas._sum.valor ?? 0).minus(
      todasSaidas._sum.valor ?? 0,
    );
    let acumulado = saldoAtual;
    const projecoes = Array.from({ length: dados.mesesProjecao }, (_, indice): MesProjetado => {
      const data = somarMeses(inicioProjecao, indice);
      const chave = chaveMes(data);
      const conhecidos = futuros.filter((item) => chaveMes(item.vencimento ?? item.data) === chave);
      const receber = somar(conhecidos.filter((item) => item.tipo === 'entrada'));
      const pagar = somar(conhecidos.filter((item) => item.tipo === 'saida'));
      const entradas = maiorDecimal(mediaEntradas, receber);
      const saidas = maiorDecimal(mediaSaidas, pagar);
      acumulado = acumulado.plus(entradas.minus(saidas));
      return {
        mes: chave,
        entradas: moeda(entradas),
        saidas: moeda(saidas),
        saldo: moeda(entradas.minus(saidas)),
        saldoAcumulado: moeda(acumulado),
        contasAReceberConhecidas: moeda(receber),
        contasAPagarConhecidas: moeda(pagar),
      };
    });
    return {
      saldoAtual: moeda(saldoAtual),
      historico,
      projecoes,
    };
  }
}

function inicioMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}
function somarMeses(data: Date, quantidade: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + quantidade, 1));
}
function chaveMes(data: Date): string {
  return data.toISOString().slice(0, 7);
}
function moeda(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}
function somar(itens: Array<{ valor: Prisma.Decimal }>): Prisma.Decimal {
  return itens.reduce((total, item) => total.plus(item.valor), new Prisma.Decimal(0));
}
function mediaPonderada(valores: Prisma.Decimal[]): Prisma.Decimal {
  const pesoTotal = valores.reduce((total, _, indice) => total + indice + 1, 0);
  return pesoTotal === 0
    ? new Prisma.Decimal(0)
    : valores
        .reduce(
          (total, valor, indice) => total.plus(valor.times(indice + 1)),
          new Prisma.Decimal(0),
        )
        .dividedBy(pesoTotal);
}
function maiorDecimal(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.greaterThan(b) ? a : b;
}
