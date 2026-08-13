import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type Paginado,
  type Servico,
  type ServicoFormInput,
  type ServicosQuery,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';

/** O registro como vem do banco, com dinheiro em Decimal. */
type ServicoBanco = {
  id: string;
  nome: string;
  categoria: string | null;
  custoBase: Prisma.Decimal;
  precoPadrao: Prisma.Decimal | null;
  ativo: boolean;
  criadoEm: Date;
};

@Injectable()
export class ServicosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ServicosQuery): Promise<Paginado<Servico>> {
    const { pagina, porPagina, busca, somenteAtivos } = query;

    const where: Prisma.ServicoWhereInput = {};

    if (somenteAtivos) {
      where.ativo = true;
    }

    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { categoria: { contains: busca, mode: 'insensitive' } },
      ];
    }

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.servico.findMany({
          where,
          orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        tx.servico.count({ where }),
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

  async buscarPorId(id: string): Promise<Servico> {
    const servico = await this.prisma.comTenant((tx) => tx.servico.findUnique({ where: { id } }));

    if (!servico) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Serviço não encontrado.',
      });
    }

    return this.paraResposta(servico);
  }

  async criar(dados: ServicoFormInput): Promise<Servico> {
    await this.garantirNomeDisponivel(dados.nome);

    const servico = await this.prisma.comTenant((tx) =>
      tx.servico.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...dados },
      }),
    );

    return this.paraResposta(servico);
  }

  async atualizar(id: string, dados: ServicoFormInput): Promise<Servico> {
    const atual = await this.buscarPorId(id);

    if (atual.nome !== dados.nome) {
      await this.garantirNomeDisponivel(dados.nome);
    }

    const servico = await this.prisma.comTenant((tx) =>
      tx.servico.update({ where: { id }, data: dados }),
    );

    return this.paraResposta(servico);
  }

  /**
   * Desativa o serviço em vez de apagá-lo.
   *
   * Orçamentos e lançamentos financeiros antigos apontam para ele. Apagar
   * quebraria o histórico e, com ele, o relatório de margem dos meses
   * anteriores — que passaria a mostrar receita sem saber de qual serviço veio.
   * Desativado, ele some das listas novas e o passado continua íntegro.
   */
  async desativar(id: string): Promise<Servico> {
    await this.buscarPorId(id);

    const servico = await this.prisma.comTenant((tx) =>
      tx.servico.update({ where: { id }, data: { ativo: false } }),
    );

    return this.paraResposta(servico);
  }

  private async garantirNomeDisponivel(nome: string): Promise<void> {
    const existente = await this.prisma.comTenant((tx) =>
      tx.servico.findFirst({ where: { nome }, select: { id: true } }),
    );

    if (existente) {
      throw new ConflictException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: 'Já existe um serviço com este nome.',
      });
    }
  }

  /**
   * Converte o registro do banco no formato da API.
   *
   * `Decimal` vira **string**, não `number`: o banco guarda em `NUMERIC` para
   * não perder centavos, e converter para número aqui jogaria fora exatamente
   * a precisão que o `NUMERIC` existe para preservar (arquitetura §7).
   */
  private paraResposta(registro: ServicoBanco): Servico {
    return {
      id: registro.id,
      nome: registro.nome,
      categoria: registro.categoria,
      custoBase: registro.custoBase.toFixed(2),
      precoPadrao: registro.precoPadrao?.toFixed(2) ?? null,
      ativo: registro.ativo,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
