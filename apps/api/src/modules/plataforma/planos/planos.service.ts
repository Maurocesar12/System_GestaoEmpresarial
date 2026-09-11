import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HIERARQUIA_PLANOS,
  calcularAcesso,
  LIMITE_PREVISOES_IA_GRATUITAS_MENSAIS,
  type PlanoCatalogo,
  type PlanoAtualResponse,
  type PlanosCatalogoResponse,
} from '@gestao/shared-types';
import type { Env } from '../../../config/env.schema';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import { calcularMensalidade } from './calcular-mensalidade';

@Injectable()
export class PlanosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async catalogo(): Promise<PlanosCatalogoResponse> {
    const planos = await this.prisma.semTenant('listar catálogo ativo de planos comerciais', (db) =>
      db.plano.findMany({
        where: { ativo: true, slug: { in: [...HIERARQUIA_PLANOS] } },
        orderBy: [{ nivel: 'asc' }, { preco: 'asc' }],
      }),
    );

    return {
      planos: planos.map((plano) => this.paraCatalogo(plano)),
      hierarquia: HIERARQUIA_PLANOS,
      totalAtivos: planos.length,
    };
  }

  async atual(): Promise<PlanoAtualResponse> {
    const inicioDoMes = new Date();
    inicioDoMes.setUTCDate(1);
    inicioDoMes.setUTCHours(0, 0, 0, 0);

    const { tenant, usuarios, clientes, previsoes } = await this.prisma.comTenant(async (tx) => {
      const [tenant, usuarios, clientes, previsoes] = await Promise.all([
        tx.tenant.findUniqueOrThrow({ where: { id: tenantAtual() }, include: { plano: true } }),
        tx.usuario.count({ where: { ativo: true } }),
        tx.cliente.count(),
        tx.previsaoFinanceira.count({
          where: { criadoEm: { gte: inicioDoMes }, modelo: { not: 'processando' } },
        }),
      ]);
      return { tenant, usuarios, clientes, previsoes };
    });
    const cobranca = calcularMensalidade({
      precoBase: tenant.plano.preco,
      usuariosAtivos: usuarios,
      usuariosInclusos: tenant.plano.usuariosInclusos,
      precoUsuarioAdicional: tenant.plano.precoUsuarioAdicional,
    });

    return {
      plano: {
        slug: tenant.plano.slug,
        nome: tenant.plano.nome,
        descricao: tenant.plano.descricao,
        nivel: tenant.plano.nivel,
        destaque: tenant.plano.destaque,
        preco: tenant.plano.preco.toFixed(2),
        iaHabilitada: tenant.plano.iaHabilitada,
      },
      cobranca: {
        precoBase: tenant.plano.preco.toFixed(2),
        usuariosInclusos: tenant.plano.usuariosInclusos,
        usuariosAdicionais: cobranca.usuariosAdicionais,
        precoPorUsuarioAdicional: tenant.plano.precoUsuarioAdicional.toFixed(2),
        adicionalUsuarios: cobranca.adicionalUsuarios.toFixed(2),
        mensalidadeEstimada: cobranca.mensalidade.toFixed(2),
      },
      limites: {
        usuarios: tenant.plano.limiteUsuarios,
        clientes: tenant.plano.limiteClientes,
        previsoesIaMensais: tenant.plano.iaHabilitada
          ? tenant.plano.limitePrevisoesIaMensais
          : LIMITE_PREVISOES_IA_GRATUITAS_MENSAIS,
      },
      uso: { usuarios, clientes, previsoesIaNoMes: previsoes },
      assinatura: {
        status: tenant.status,
        trialTerminaEm: tenant.trialTerminaEm?.toISOString() ?? null,
        ultimoPagamentoEm: tenant.ultimoPagamentoEm?.toISOString().slice(0, 10) ?? null,
        acesso: calcularAcesso({
          status: tenant.status,
          trialTerminaEm: tenant.trialTerminaEm?.toISOString() ?? null,
          ultimoPagamentoEm: tenant.ultimoPagamentoEm?.toISOString() ?? null,
        }),
      },
      integracaoIa: {
        conectada: Boolean(this.config.get('OPENAI_API_KEY', { infer: true })),
        modo: this.config.get('OPENAI_API_KEY', { infer: true }) ? 'openai' : 'demonstracao',
      },
    };
  }

  private paraCatalogo(plano: {
    slug: string;
    nome: string;
    descricao: string;
    nivel: number;
    destaque: boolean;
    preco: { toFixed(casas: number): string };
    usuariosInclusos: number | null;
    precoUsuarioAdicional: { toFixed(casas: number): string };
    limiteUsuarios: number | null;
    limiteClientes: number | null;
    limiteEnviosMensais: number | null;
    iaHabilitada: boolean;
    limitePrevisoesIaMensais: number | null;
  }): PlanoCatalogo {
    const slug = HIERARQUIA_PLANOS.find((item) => item === plano.slug);

    if (!slug) {
      throw new Error(`Plano ativo fora da hierarquia comercial: ${plano.slug}`);
    }

    return {
      slug,
      nome: plano.nome,
      descricao: plano.descricao,
      nivel: plano.nivel,
      destaque: plano.destaque,
      preco: plano.preco.toFixed(2),
      usuariosInclusos: plano.usuariosInclusos,
      precoUsuarioAdicional: plano.precoUsuarioAdicional.toFixed(2),
      limiteUsuarios: plano.limiteUsuarios,
      limiteClientes: plano.limiteClientes,
      limiteEnviosMensais: plano.limiteEnviosMensais,
      iaHabilitada: plano.iaHabilitada,
      limitePrevisoesIaMensais: plano.limitePrevisoesIaMensais,
    };
  }
}
