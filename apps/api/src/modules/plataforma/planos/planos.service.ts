import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlanoAtualResponse } from '@gestao/shared-types';
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
        previsoesIaMensais: tenant.plano.limitePrevisoesIaMensais,
      },
      uso: { usuarios, clientes, previsoesIaNoMes: previsoes },
      assinatura: {
        status: tenant.status,
        trialTerminaEm: tenant.trialTerminaEm?.toISOString() ?? null,
      },
      integracaoIa: {
        conectada: Boolean(this.config.get('OPENAI_API_KEY', { infer: true })),
        modo: this.config.get('OPENAI_API_KEY', { infer: true }) ? 'openai' : 'demonstracao',
      },
    };
  }
}
