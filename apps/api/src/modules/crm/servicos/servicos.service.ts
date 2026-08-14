import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  type Paginado,
  type Servico,
  type ServicoFormInput,
  type ServicosQuery,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';

/** O registro como vem do banco, com dinheiro em Decimal. */
type ServicoBanco = Prisma.ServicoGetPayload<object>;

@Injectable()
export class ServicosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ServicosQuery): Promise<Paginado<Servico>> {
    const where: Prisma.ServicoWhereInput = {};

    if (query.somenteAtivos) {
      where.ativo = true;
    }

    if (query.busca) {
      where.OR = [
        { nome: { contains: query.busca, mode: 'insensitive' } },
        { categoria: { contains: query.busca, mode: 'insensitive' } },
      ];
    }

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.servico.findMany({
          where,
          orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.servico.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => this.paraResposta(registro)),
      total,
      query,
    );
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
    const servico = await this.prisma.comTenant(async (tx) => {
      await this.garantirNomeDisponivel(tx, dados.nome);

      return tx.servico.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...dados },
      });
    });

    return this.paraResposta(servico);
  }

  /**
   * Atualiza um serviço.
   *
   * Leitura e escrita na **mesma** transação. Cada `comTenant` abre uma
   * transação própria (`BEGIN`, `set_config`, consulta, `COMMIT`); a versão
   * anterior abria três para um único PATCH — uma para conferir a existência,
   * outra para conferir o nome, a terceira para gravar.
   */
  async atualizar(id: string, dados: ServicoFormInput): Promise<Servico> {
    const servico = await this.prisma.comTenant(async (tx) => {
      const atual = await tx.servico.findUnique({ where: { id }, select: { nome: true } });

      if (!atual) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Serviço não encontrado.',
        });
      }

      if (atual.nome !== dados.nome) {
        await this.garantirNomeDisponivel(tx, dados.nome);
      }

      return tx.servico.update({ where: { id }, data: dados });
    });

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
    const servico = await this.prisma.comTenant(async (tx) => {
      const existe = await tx.servico.findUnique({ where: { id }, select: { id: true } });

      if (!existe) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Serviço não encontrado.',
        });
      }

      return tx.servico.update({ where: { id }, data: { ativo: false } });
    });

    return this.paraResposta(servico);
  }

  private async garantirNomeDisponivel(tx: TransacaoComTenant, nome: string): Promise<void> {
    const existente = await tx.servico.findFirst({ where: { nome }, select: { id: true } });

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
