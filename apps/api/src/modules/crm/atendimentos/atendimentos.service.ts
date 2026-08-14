import { Injectable, NotFoundException } from '@nestjs/common';
import { CODIGOS_ERRO, type Atendimento, type AtendimentoFormInput } from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';

/** Registro do banco, com data como `Date`. */
type AtendimentoBanco = {
  id: string;
  clienteId: string;
  descricao: string;
  data: Date;
  criadoEm: Date;
};

@Injectable()
export class AtendimentosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Histórico de um cliente, do mais recente para o mais antigo. */
  async listarPorCliente(clienteId: string): Promise<Atendimento[]> {
    const registros = await this.prisma.comTenant((tx) =>
      tx.atendimento.findMany({
        where: { clienteId },
        // Desempate por `criadoEm`: dois atendimentos no mesmo dia devem sair
        // na ordem em que foram registrados, e não em ordem indefinida.
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
      }),
    );

    return registros.map((registro) => this.paraResposta(registro));
  }

  async criar(clienteId: string, dados: AtendimentoFormInput): Promise<Atendimento> {
    const atendimento = await this.prisma.comTenant(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteId },
        select: { id: true },
      });

      if (!cliente) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Cliente não encontrado.',
        });
      }

      return tx.atendimento.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          clienteId,
          descricao: dados.descricao,
          // `T00:00:00Z` explícito: sem ele, o Postgres interpretaria a string
          // no fuso do servidor e o registro poderia cair no dia anterior.
          data: new Date(`${dados.data}T00:00:00Z`),
        },
      });
    });

    return this.paraResposta(atendimento);
  }

  async remover(id: string): Promise<void> {
    const removidos = await this.prisma.comTenant((tx) =>
      tx.atendimento.deleteMany({ where: { id } }),
    );

    if (removidos.count === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Atendimento não encontrado.',
      });
    }
  }

  private paraResposta(registro: AtendimentoBanco): Atendimento {
    return {
      id: registro.id,
      clienteId: registro.clienteId,
      descricao: registro.descricao,
      // Corta em 10 caracteres para devolver a data pura, sem que o fuso do
      // servidor a empurre um dia para trás.
      data: registro.data.toISOString().slice(0, 10),
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
