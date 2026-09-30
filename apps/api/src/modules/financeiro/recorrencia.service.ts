import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  ocorrenciaDoCiclo,
  type LancamentoRecorrente,
  type RecorrenciaFormInput,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { garantirVinculos } from '../../common/vinculos';
import { paraData, paraDia } from './datas';
import { AuditoriaService } from '../plataforma/auditoria/auditoria.service';

const RELACIONAMENTOS = {
  categoria: { select: { nome: true } },
  servico: { select: { nome: true } },
  cliente: { select: { nome: true } },
  _count: { select: { lancamentos: true } },
} as const;

type RecorrenteBanco = Prisma.LancamentoRecorrenteGetPayload<{ include: typeof RELACIONAMENTOS }>;

/**
 * Lançamentos recorrentes: os moldes das despesas e receitas que se repetem.
 *
 * Este serviço cuida do cadastro. Quem transforma molde em lançamento é o
 * `RecorrenciaAgendador`, que roda de madrugada — a separação existe porque as
 * duas coisas têm contexto diferente: aqui há um usuário logado, lá não.
 */
@Injectable()
export class RecorrenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<LancamentoRecorrente[]> {
    const registros = await this.prisma.comTenant((tx) =>
      tx.lancamentoRecorrente.findMany({
        include: RELACIONAMENTOS,
        // Ativos primeiro, e dentro deles o que vence antes: a ordem em que a
        // pessoa precisa olhar. Desligados descem para o fim da lista.
        orderBy: [{ ativo: 'desc' }, { proximaEm: 'asc' }],
      }),
    );

    return registros.map((registro) => this.paraResposta(registro));
  }

  async criar(dados: RecorrenciaFormInput): Promise<LancamentoRecorrente> {
    const registro = await this.prisma.comTenant(async (tx) => {
      await garantirVinculos(tx, dados);

      const criado = await tx.lancamentoRecorrente.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          tipo: dados.tipo,
          natureza: dados.natureza,
          descricao: dados.descricao,
          valor: dados.valor,
          periodicidade: dados.periodicidade,
          inicio: paraData(dados.inicio)!,
          // A primeira ocorrência ainda não foi gerada, então o cursor é zero e
          // a próxima é o próprio início.
          ocorrencias: 0,
          proximaEm: paraData(dados.inicio)!,
          fim: paraData(dados.fim),
          categoriaId: dados.categoriaId,
          servicoId: dados.servicoId,
          clienteId: dados.clienteId,
        },
        include: RELACIONAMENTOS,
      });

      await this.auditoria.registrar(tx, {
        entidade: 'lancamento',
        entidadeId: criado.id,
        acao: 'criou',
        resumo: `Recorrência criada: ${criado.descricao} (${criado.periodicidade})`,
        depois: { descricao: criado.descricao, valor: criado.valor.toFixed(2) },
      });

      return criado;
    });

    return this.paraResposta(registro);
  }

  /**
   * Liga ou desliga uma recorrência.
   *
   * Desligar em vez de apagar é o que preserva os lançamentos já gerados: eles
   * apontam para o molde, e alguns já podem estar pagos. Apagar seria perder o
   * rastro de por que aquela conta existe.
   */
  async alternarAtivo(id: string, ativo: boolean): Promise<LancamentoRecorrente> {
    const registro = await this.prisma.comTenant(async (tx) => {
      const atual = await tx.lancamentoRecorrente.findUnique({
        where: { id },
        select: { ativo: true, descricao: true },
      });

      if (!atual) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Recorrência não encontrada.',
        });
      }

      if (atual.ativo === ativo) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: ativo ? 'Esta recorrência já está ativa.' : 'Esta recorrência já está pausada.',
        });
      }

      const alterado = await tx.lancamentoRecorrente.update({
        where: { id },
        data: { ativo },
        include: RELACIONAMENTOS,
      });

      await this.auditoria.registrar(tx, {
        entidade: 'lancamento',
        entidadeId: id,
        acao: 'movimentou',
        resumo: `Recorrência ${ativo ? 'retomada' : 'pausada'}: ${atual.descricao}`,
        antes: { ativo: atual.ativo },
        depois: { ativo },
      });

      return alterado;
    });

    return this.paraResposta(registro);
  }

  /**
   * Apaga o molde.
   *
   * Os lançamentos já gerados **ficam**: o `ON DELETE SET NULL` da coluna
   * `recorrencia_id` solta o vínculo sem levar o histórico financeiro embora.
   * Quem quer parar de gerar sem perder a referência usa `alternarAtivo`.
   */
  async remover(id: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const atual = await tx.lancamentoRecorrente.findUnique({
        where: { id },
        select: { descricao: true },
      });

      if (!atual) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Recorrência não encontrada.',
        });
      }

      await tx.lancamentoRecorrente.delete({ where: { id } });

      await this.auditoria.registrar(tx, {
        entidade: 'lancamento',
        entidadeId: id,
        acao: 'excluiu',
        resumo: `Recorrência excluída: ${atual.descricao}`,
        antes: { descricao: atual.descricao },
      });
    });
  }

  private paraResposta(registro: RecorrenteBanco): LancamentoRecorrente {
    const inicio = paraDia(registro.inicio)!;

    return {
      id: registro.id,
      tipo: registro.tipo,
      natureza: registro.natureza,
      descricao: registro.descricao,
      valor: registro.valor.toFixed(2),
      periodicidade: registro.periodicidade,
      inicio,
      // Recalculada da âncora em vez de lida da coluna: se as duas divergirem
      // por qualquer motivo, a verdade é o cálculo — a coluna é só o índice.
      proximaEm: ocorrenciaDoCiclo(inicio, registro.periodicidade, registro.ocorrencias),
      fim: paraDia(registro.fim),
      ativo: registro.ativo,
      categoriaId: registro.categoriaId,
      categoriaNome: registro.categoria?.nome ?? null,
      servicoId: registro.servicoId,
      servicoNome: registro.servico?.nome ?? null,
      clienteId: registro.clienteId,
      clienteNome: registro.cliente?.nome ?? null,
      ocorrenciasGeradas: registro._count.lancamentos,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}
