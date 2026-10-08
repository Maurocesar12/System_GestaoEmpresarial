import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  ROTULO_STATUS_LEMBRETE,
  paginar,
  type LembreteFollowUp,
  type LembreteFormInput,
  type LembretesQuery,
  type Paginado,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import { naoEncontrado } from '../../../common/erros';
import { fimDoDia, inicioDoDia, instanteDeHorarioLocal } from '../../../common/fuso';

const INCLUDE_PADRAO = {
  cliente: { select: { nome: true, email: true, telefone: true } },
} as const;

type LembreteBanco = Prisma.LembreteFollowUpGetPayload<{ include: typeof INCLUDE_PADRAO }>;

@Injectable()
export class LembretesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: LembretesQuery): Promise<Paginado<LembreteFollowUp>> {
    const { pagina, porPagina, status, canal, clienteId, de, ate } = query;

    const where: Prisma.LembreteFollowUpWhereInput = {};
    if (status) where.status = status;
    if (canal) where.canal = canal;
    if (clienteId) where.clienteId = clienteId;

    if (de || ate) {
      where.dataEnvio = {
        ...(de ? { gte: inicioDoDia(de) } : {}),
        ...(ate ? { lte: fimDoDia(ate) } : {}),
      };
    }

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.lembreteFollowUp.findMany({
          where,
          include: INCLUDE_PADRAO,
          orderBy: [{ dataEnvio: 'asc' }, { criadoEm: 'asc' }],
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        tx.lembreteFollowUp.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => this.paraResposta(registro)),
      total,
      query,
    );
  }

  async buscarPorId(id: string): Promise<LembreteFollowUp> {
    const lembrete = await this.prisma.comTenant((tx) =>
      tx.lembreteFollowUp.findUnique({ where: { id }, include: INCLUDE_PADRAO }),
    );

    if (!lembrete) {
      throw naoEncontrado('Lembrete não encontrado.');
    }

    return this.paraResposta(lembrete);
  }

  async criar(dados: LembreteFormInput): Promise<LembreteFollowUp> {
    const lembrete = await this.prisma.comTenant(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: dados.clienteId },
        select: { id: true },
      });

      if (!cliente) {
        throw naoEncontrado('Cliente não encontrado.');
      }

      return tx.lembreteFollowUp.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          clienteId: dados.clienteId,
          canal: dados.canal,
          dataEnvio: instanteDeHorarioLocal(dados.dataEnvio),
        },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(lembrete);
  }

  async cancelar(id: string): Promise<LembreteFollowUp> {
    const lembrete = await this.prisma.comTenant(async (tx) => {
      const atual = await tx.lembreteFollowUp.findUnique({
        where: { id },
        include: INCLUDE_PADRAO,
      });

      if (!atual) {
        throw naoEncontrado('Lembrete não encontrado.');
      }

      if (atual.status !== 'pendente') {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Lembrete ${ROTULO_STATUS_LEMBRETE[
            atual.status
          ].toLowerCase()} não pode ser cancelado.`,
        });
      }

      return tx.lembreteFollowUp.update({
        where: { id },
        data: { status: 'cancelado' },
        include: INCLUDE_PADRAO,
      });
    });

    return this.paraResposta(lembrete);
  }

  private paraResposta(registro: LembreteBanco): LembreteFollowUp {
    return {
      id: registro.id,
      clienteId: registro.clienteId,
      clienteNome: registro.cliente.nome,
      clienteEmail: registro.cliente.email,
      clienteTelefone: registro.cliente.telefone,
      canal: registro.canal,
      status: registro.status,
      dataEnvio: registro.dataEnvio.toISOString(),
      enviadoEm: registro.enviadoEm?.toISOString() ?? null,
      erro: registro.erro,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
