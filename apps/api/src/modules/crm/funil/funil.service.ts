import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type ColunaFunil,
  type EtapaFormInput,
  type EtapaFunil,
  type MoverClienteInput,
  type QuadroFunil,
  type ReordenarEtapasInput,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import type { MarcoFunil } from '../../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';

/**
 * Funil de vendas.
 *
 * O quadro é montado em duas consultas — etapas e posições —, e não uma por
 * etapa. Com sete etapas, a versão ingênua faria oito idas ao banco a cada
 * carregamento da tela; esta faz duas, independente de quantas etapas a empresa
 * tenha.
 */
@Injectable()
export class FunilService {
  private readonly logger = new Logger(FunilService.name);

  /**
   * Teto de clientes carregados por etapa no quadro.
   *
   * Um kanban não é lugar para listar mil cartões: o navegador engasga e
   * ninguém rola até o fim. Quem precisa ver todos usa a listagem de clientes,
   * que tem paginação e busca.
   */
  private readonly LIMITE_POR_ETAPA = 50;

  constructor(private readonly prisma: PrismaService) {}

  async montarQuadro(): Promise<QuadroFunil> {
    const { etapas, posicoes, orcamentos, totalForaDoFunil } = await this.prisma.comTenant(
      async (tx) => {
        const etapas = await tx.etapaFunil.findMany({ orderBy: { ordem: 'asc' } });

        const posicoes = await tx.clienteFunil.findMany({
          include: {
            cliente: {
              select: { id: true, nome: true, telefone: true, email: true, origem: true },
            },
          },
          orderBy: { atualizadoEm: 'desc' },
        });

        // Os orçamentos em aberto de todos os clientes do quadro, numa consulta
        // só. Buscar por cliente faria uma ida ao banco por cartão — com
        // cinquenta clientes no funil, cinquenta consultas para montar uma tela.
        const clientesNoFunil = posicoes.map((posicao) => posicao.clienteId);

        const orcamentos =
          clientesNoFunil.length === 0
            ? []
            : await tx.orcamento.findMany({
                where: { status: 'aberto', clienteId: { in: clientesNoFunil } },
                select: {
                  id: true,
                  clienteId: true,
                  valor: true,
                  servico: { select: { nome: true } },
                },
                // Mais recente primeiro: é a proposta que está valendo.
                orderBy: { criadoEm: 'desc' },
              });

        // Clientes cadastrados que ainda não entraram no funil.
        const totalForaDoFunil = await tx.cliente.count({
          where: { posicaoFunil: { is: null } },
        });

        return { etapas, posicoes, orcamentos, totalForaDoFunil };
      },
    );

    // Um orçamento por cliente: o primeiro de cada, que a ordenação garante ser
    // o mais recente.
    const orcamentoPorCliente = new Map<string, (typeof orcamentos)[number]>();

    for (const orcamento of orcamentos) {
      if (!orcamentoPorCliente.has(orcamento.clienteId)) {
        orcamentoPorCliente.set(orcamento.clienteId, orcamento);
      }
    }

    // Agrupa em memória: os dados já vieram do banco, e um `Map` evita
    // percorrer a lista inteira de posições uma vez por etapa.
    const porEtapa = new Map<string, ColunaFunil['clientes']>();

    for (const posicao of posicoes) {
      const lista = porEtapa.get(posicao.etapaId) ?? [];

      if (lista.length < this.LIMITE_POR_ETAPA) {
        const orcamento = orcamentoPorCliente.get(posicao.clienteId);

        lista.push({
          id: posicao.cliente.id,
          nome: posicao.cliente.nome,
          telefone: posicao.cliente.telefone,
          email: posicao.cliente.email,
          origem: posicao.cliente.origem,
          atualizadoEm: posicao.atualizadoEm.toISOString(),
          orcamentoAberto: orcamento
            ? {
                id: orcamento.id,
                // Decimal vira string, nunca number: é o que preserva os
                // centavos que o NUMERIC do banco guarda.
                valor: orcamento.valor.toFixed(2),
                servicoNome: orcamento.servico?.nome ?? null,
              }
            : null,
        });
      }

      porEtapa.set(posicao.etapaId, lista);
    }

    return {
      colunas: etapas.map((etapa) => ({
        etapa: { id: etapa.id, nome: etapa.nome, ordem: etapa.ordem },
        clientes: porEtapa.get(etapa.id) ?? [],
      })),
      totalForaDoFunil,
    };
  }

  /**
   * Move um cliente para uma etapa — ou o coloca no funil pela primeira vez.
   *
   * `upsert` porque as duas situações são a mesma operação do ponto de vista de
   * quem usa: arrastar o cartão. Separar em "criar posição" e "mover posição"
   * obrigaria a tela a saber em qual caso está, sem nenhum ganho.
   */
  async mover({ clienteId, etapaId }: MoverClienteInput): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      // As duas verificações existem para dar erro claro. A RLS já impede
      // atravessar empresas, mas sem elas um id inexistente viraria erro de
      // chave estrangeira do Postgres, que não diz nada a quem está usando.
      const [cliente, etapa] = await Promise.all([
        tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
        tx.etapaFunil.findUnique({ where: { id: etapaId }, select: { id: true } }),
      ]);

      if (!cliente) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Cliente não encontrado.',
        });
      }

      if (!etapa) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Etapa não encontrada.',
        });
      }

      await tx.clienteFunil.upsert({
        where: { clienteId },
        create: { id: uuidv7(), tenantId: tenantAtual(), clienteId, etapaId },
        update: { etapaId },
      });
    });
  }

  /** Tira o cliente do funil, sem apagar o cadastro dele. */
  async removerDoFunil(clienteId: string): Promise<void> {
    await this.prisma.comTenant((tx) => tx.clienteFunil.deleteMany({ where: { clienteId } }));
  }

  /**
   * Move o cliente para a etapa que cumpre determinado papel no processo.
   *
   * É o que liga os módulos: quando um orçamento é emitido, o cliente vai para
   * a etapa marcada como `orcamento_enviado`; quando aprovado, para a
   * `fechado`. A busca é pelo **marco**, não pelo nome — assim renomear a etapa
   * não quebra a automação.
   *
   * **Nunca falha a operação que a chamou.** Se a empresa apagou a etapa com
   * aquele marco, ou nunca a teve, o método simplesmente não faz nada. Um
   * orçamento não pode deixar de ser aprovado porque o funil está configurado
   * de outro jeito — a automação é conveniência, não requisito.
   *
   * @param tx Transação de quem chamou. Receber a transação em vez de abrir uma
   *   nova mantém a movimentação e a operação de origem atômicas: ou as duas
   *   acontecem, ou nenhuma.
   * @returns O nome da etapa de destino, ou `null` se não houve movimento.
   */
  async moverParaMarco(
    tx: TransacaoComTenant,
    clienteId: string,
    marco: MarcoFunil,
  ): Promise<string | null> {
    const etapa = await tx.etapaFunil.findFirst({ where: { marco } });

    if (!etapa) {
      this.logger.debug(`Nenhuma etapa marcada como "${marco}" — cliente não foi movido.`);
      return null;
    }

    await tx.clienteFunil.upsert({
      where: { clienteId },
      create: { id: uuidv7(), tenantId: tenantAtual(), clienteId, etapaId: etapa.id },
      update: { etapaId: etapa.id },
    });

    return etapa.nome;
  }

  /** Define qual etapa cumpre determinado marco, tirando-o de qualquer outra. */
  async definirMarco(etapaId: string, marco: MarcoFunil | null): Promise<EtapaFunil> {
    return this.prisma.comTenant(async (tx) => {
      const etapa = await tx.etapaFunil.findUnique({ where: { id: etapaId } });

      if (!etapa) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Etapa não encontrada.',
        });
      }

      // Só uma etapa por marco (o banco garante com índice único). Liberar a
      // anterior antes evita colidir com essa restrição.
      if (marco) {
        await tx.etapaFunil.updateMany({
          where: { marco, id: { not: etapaId } },
          data: { marco: null },
        });
      }

      const atualizada = await tx.etapaFunil.update({
        where: { id: etapaId },
        data: { marco },
      });

      return { id: atualizada.id, nome: atualizada.nome, ordem: atualizada.ordem };
    });
  }

  async listarEtapas(): Promise<EtapaFunil[]> {
    const etapas = await this.prisma.comTenant((tx) =>
      tx.etapaFunil.findMany({ orderBy: { ordem: 'asc' } }),
    );

    return etapas.map((etapa) => ({ id: etapa.id, nome: etapa.nome, ordem: etapa.ordem }));
  }

  async criarEtapa({ nome }: EtapaFormInput): Promise<EtapaFunil> {
    const etapa = await this.prisma.comTenant(async (tx) => {
      // A etapa nova entra no fim do funil. Reordenar depois é um arrastar.
      const ultima = await tx.etapaFunil.findFirst({ orderBy: { ordem: 'desc' } });

      return tx.etapaFunil.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          nome,
          ordem: (ultima?.ordem ?? 0) + 1,
        },
      });
    });

    return { id: etapa.id, nome: etapa.nome, ordem: etapa.ordem };
  }

  async renomearEtapa(id: string, { nome }: EtapaFormInput): Promise<EtapaFunil> {
    const etapa = await this.prisma.comTenant(async (tx) => {
      const existente = await tx.etapaFunil.findUnique({ where: { id } });

      if (!existente) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Etapa não encontrada.',
        });
      }

      return tx.etapaFunil.update({ where: { id }, data: { nome } });
    });

    return { id: etapa.id, nome: etapa.nome, ordem: etapa.ordem };
  }

  /**
   * Remove uma etapa.
   *
   * Recusa se houver cliente nela. Apagar em cascata tiraria pessoas do funil
   * sem aviso, e quem clicou não faz ideia de quantas eram — melhor exigir que
   * sejam movidas primeiro, uma decisão consciente.
   */
  async removerEtapa(id: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const etapa = await tx.etapaFunil.findUnique({
        where: { id },
        include: { _count: { select: { clientes: true } } },
      });

      if (!etapa) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Etapa não encontrada.',
        });
      }

      if (etapa._count.clientes > 0) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: `Esta etapa tem ${etapa._count.clientes} cliente(s). Mova-os para outra etapa antes de excluí-la.`,
        });
      }

      await tx.etapaFunil.deleteMany({ where: { id } });
    });
  }

  /**
   * Reordena as etapas.
   *
   * A coluna `ordem` tem restrição de unicidade por empresa, então trocar duas
   * etapas de lugar em uma única passada esbarraria na restrição no meio do
   * caminho. A saída é gravar em duas fases: primeiro todas recebem valores
   * negativos temporários, livres de colisão, e depois a ordem definitiva.
   */
  async reordenarEtapas({ etapaIds }: ReordenarEtapasInput): Promise<EtapaFunil[]> {
    return this.prisma.comTenant(async (tx) => {
      const existentes = await tx.etapaFunil.findMany({ select: { id: true } });
      const idsConhecidos = new Set(existentes.map((etapa) => etapa.id));

      const desconhecido = etapaIds.find((id) => !idsConhecidos.has(id));
      if (desconhecido) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Uma das etapas informadas não existe.',
        });
      }

      if (etapaIds.length !== existentes.length) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.VALIDACAO,
          mensagem: 'Informe todas as etapas do funil na nova ordem.',
        });
      }

      // Fase 1: valores temporários, fora da faixa usada pela ordem real.
      for (const [indice, id] of etapaIds.entries()) {
        await tx.etapaFunil.update({ where: { id }, data: { ordem: -(indice + 1) } });
      }

      // Fase 2: a ordem definitiva.
      for (const [indice, id] of etapaIds.entries()) {
        await tx.etapaFunil.update({ where: { id }, data: { ordem: indice + 1 } });
      }

      const atualizadas = await tx.etapaFunil.findMany({ orderBy: { ordem: 'asc' } });

      return atualizadas.map((etapa) => ({
        id: etapa.id,
        nome: etapa.nome,
        ordem: etapa.ordem,
      }));
    });
  }
}
