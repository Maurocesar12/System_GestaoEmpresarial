import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  type AjusteEstoqueInput,
  type EntradaEstoqueInput,
  type FichaTecnica,
  type FichaTecnicaInput,
  type ItemMaterialInput,
  type Material,
  type MaterialDetalhe,
  type MaterialFormInput,
  type MateriaisQuery,
  type Paginado,
  type UnidadeMaterial,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { obterContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';
import { hojeEmDia } from '../../financeiro/datas';
import { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';
import { custoMedioAposEntrada, paraQuantidade, valorMovimentacao } from './calculo-estoque';

type MaterialBanco = Prisma.MaterialGetPayload<object>;

const ZERO = new Prisma.Decimal(0);

/**
 * Estoque de materiais.
 *
 * Toda movimentação trava a linha do material (`FOR UPDATE`) antes de ler o
 * saldo. Sem isso, duas entradas simultâneas leriam o mesmo custo médio e a
 * segunda sobrescreveria a ponderação da primeira.
 */
@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(query: MateriaisQuery): Promise<Paginado<Material>> {
    const where: Prisma.MaterialWhereInput = {};

    if (query.somenteAtivos) where.ativo = true;
    if (query.busca) where.nome = { contains: query.busca, mode: 'insensitive' };
    if (query.abaixoDoMinimo) {
      where.estoqueMinimo = { not: null };
      where.quantidade = { lte: this.prisma.material.fields.estoqueMinimo };
    }

    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.material.findMany({
          where,
          orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.material.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => this.paraMaterial(registro)),
      total,
      query,
    );
  }

  async buscar(id: string): Promise<MaterialDetalhe> {
    const material = await this.prisma.comTenant((tx) =>
      tx.material.findUnique({
        where: { id },
        include: {
          movimentacoes: {
            orderBy: { criadoEm: 'desc' },
            take: 50,
            include: { servico: { select: { nome: true } } },
          },
        },
      }),
    );

    if (!material) throw this.materialNaoEncontrado();

    return {
      ...this.paraMaterial(material),
      movimentacoes: material.movimentacoes.map((mov) => ({
        id: mov.id,
        tipo: mov.tipo,
        quantidade: paraQuantidade(mov.quantidade),
        custoUnitario: mov.custoUnitario.toFixed(4),
        valorTotal: mov.valorTotal.toFixed(2),
        data: mov.data.toISOString().slice(0, 10),
        observacao: mov.observacao,
        agendamentoId: mov.agendamentoId,
        servicoNome: mov.servico?.nome ?? null,
        criadoEm: mov.criadoEm.toISOString(),
      })),
    };
  }

  async criar(dados: MaterialFormInput): Promise<Material> {
    const material = await this.prisma.comTenant(async (tx) => {
      await this.garantirNomeDisponivel(tx, dados.nome);

      const criado = await tx.material.create({
        data: {
          id: uuidv7(),
          tenantId: tenantAtual(),
          nome: dados.nome,
          unidade: dados.unidade,
          estoqueMinimo: dados.estoqueMinimo,
          ativo: dados.ativo,
        },
      });

      await this.auditoria.registrar(tx, {
        entidade: 'material',
        entidadeId: criado.id,
        acao: 'criou',
        resumo: `Material cadastrado: ${criado.nome}`,
      });

      return criado;
    });

    return this.paraMaterial(material);
  }

  async atualizar(id: string, dados: MaterialFormInput): Promise<Material> {
    const material = await this.prisma.comTenant(async (tx) => {
      const atual = await tx.material.findUnique({ where: { id } });
      if (!atual) throw this.materialNaoEncontrado();

      if (atual.nome !== dados.nome) await this.garantirNomeDisponivel(tx, dados.nome);

      const alterado = await tx.material.update({
        where: { id },
        data: {
          nome: dados.nome,
          unidade: dados.unidade,
          estoqueMinimo: dados.estoqueMinimo,
          ativo: dados.ativo,
        },
      });

      await this.auditoria.registrar(tx, {
        entidade: 'material',
        entidadeId: id,
        acao: 'alterou',
        resumo: `Material alterado: ${alterado.nome}`,
      });

      return alterado;
    });

    return this.paraMaterial(material);
  }

  async registrarEntrada(id: string, dados: EntradaEstoqueInput): Promise<Material> {
    const material = await this.prisma.comTenant(async (tx) => {
      const atual = await this.travar(tx, id);
      const quantidade = new Prisma.Decimal(dados.quantidade);
      const custo = new Prisma.Decimal(dados.custoUnitario);

      const alterado = await tx.material.update({
        where: { id },
        data: {
          quantidade: atual.quantidade.plus(quantidade),
          custoMedio: custoMedioAposEntrada(atual.quantidade, atual.custoMedio, quantidade, custo),
        },
      });

      await this.criarMovimentacao(tx, {
        materialId: id,
        tipo: 'entrada',
        quantidade,
        custoUnitario: custo,
        data: dados.data ?? hojeEmDia(),
        observacao: dados.observacao,
      });

      await this.auditoria.registrar(tx, {
        entidade: 'material',
        entidadeId: id,
        acao: 'movimentou',
        resumo: `Entrada de ${paraQuantidade(quantidade)} ${atual.unidade} de ${atual.nome} a R$ ${custo.toFixed(2)}`,
      });

      return alterado;
    });

    return this.paraMaterial(material);
  }

  async registrarAjuste(id: string, dados: AjusteEstoqueInput): Promise<Material> {
    const material = await this.prisma.comTenant(async (tx) => {
      const atual = await this.travar(tx, id);
      const contada = new Prisma.Decimal(dados.quantidadeContada);
      const diferenca = contada.minus(atual.quantidade);

      if (diferenca.isZero()) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.VALIDACAO,
          mensagem: 'A contagem é igual ao saldo atual. Não há o que ajustar.',
        });
      }

      const alterado = await tx.material.update({ where: { id }, data: { quantidade: contada } });

      await this.criarMovimentacao(tx, {
        materialId: id,
        tipo: 'ajuste',
        quantidade: diferenca,
        custoUnitario: atual.custoMedio,
        data: hojeEmDia(),
        observacao: dados.observacao,
      });

      await this.auditoria.registrar(tx, {
        entidade: 'material',
        entidadeId: id,
        acao: 'movimentou',
        resumo: `Ajuste de ${atual.nome}: ${paraQuantidade(atual.quantidade)} → ${paraQuantidade(contada)} ${atual.unidade} (${dados.observacao})`,
      });

      return alterado;
    });

    return this.paraMaterial(material);
  }

  async fichaTecnica(servicoId: string): Promise<FichaTecnica> {
    const itens = await this.prisma.comTenant(async (tx) => {
      await this.garantirServico(tx, servicoId);

      return tx.servicoMaterial.findMany({
        where: { servicoId },
        include: { material: true },
        orderBy: { material: { nome: 'asc' } },
      });
    });

    let custoEstimado = ZERO;

    const resposta = itens.map((item) => {
      const custo = valorMovimentacao(item.quantidade, item.material.custoMedio);
      custoEstimado = custoEstimado.plus(custo);

      return {
        materialId: item.materialId,
        materialNome: item.material.nome,
        unidade: item.material.unidade as UnidadeMaterial,
        quantidade: paraQuantidade(item.quantidade),
        custoMedio: item.material.custoMedio.toFixed(4),
        custoEstimado: custo.toFixed(2),
      };
    });

    return { itens: resposta, custoEstimado: custoEstimado.toFixed(2) };
  }

  async salvarFichaTecnica(servicoId: string, dados: FichaTecnicaInput): Promise<FichaTecnica> {
    await this.prisma.comTenant(async (tx) => {
      const servico = await this.garantirServico(tx, servicoId);
      await this.garantirMateriais(tx, dados.itens);

      await tx.servicoMaterial.deleteMany({ where: { servicoId } });

      if (dados.itens.length > 0) {
        await tx.servicoMaterial.createMany({
          data: dados.itens.map((item) => ({
            tenantId: tenantAtual(),
            servicoId,
            materialId: item.materialId,
            quantidade: item.quantidade,
          })),
        });
      }

      await this.auditoria.registrar(tx, {
        entidade: 'servicos',
        entidadeId: servicoId,
        acao: 'alterou',
        resumo: `Lista de materiais de ${servico.nome}: ${dados.itens.length} item(ns)`,
      });
    });

    return this.fichaTecnica(servicoId);
  }

  /**
   * Baixa os materiais de um agendamento que acabou de ser executado.
   *
   * Roda dentro da transação da execução: se a baixa falhar, o agendamento
   * continua pendente, e nunca fica executado sem o custo registrado.
   *
   * Sem `itens`, usa a lista padrão do serviço. O saldo pode ficar negativo — o
   * material foi usado de qualquer jeito, e travar a execução por uma contagem
   * errada deixaria o serviço feito sem registro nenhum.
   */
  async consumirNaExecucao(
    tx: TransacaoComTenant,
    agendamento: { id: string; servicoId: string | null; dataHora: Date },
    itens?: ItemMaterialInput[],
  ): Promise<void> {
    const lista =
      itens ??
      (agendamento.servicoId
        ? (
            await tx.servicoMaterial.findMany({
              where: { servicoId: agendamento.servicoId },
              select: { materialId: true, quantidade: true },
            })
          ).map((item) => ({ materialId: item.materialId, quantidade: item.quantidade.toString() }))
        : []);

    if (lista.length === 0) return;

    await this.garantirMateriais(tx, lista, { exigirAtivos: false });

    // Trava em ordem de id: duas execuções simultâneas com os mesmos materiais
    // pegam as travas na mesma sequência e não entram em deadlock.
    const ordenados = [...lista].sort((a, b) => a.materialId.localeCompare(b.materialId));
    const dia = diaEmSaoPaulo(agendamento.dataHora);

    for (const item of ordenados) {
      const material = await this.travar(tx, item.materialId);
      const quantidade = new Prisma.Decimal(item.quantidade);

      await tx.material.update({
        where: { id: item.materialId },
        data: { quantidade: material.quantidade.minus(quantidade) },
      });

      await this.criarMovimentacao(tx, {
        materialId: item.materialId,
        tipo: 'consumo',
        quantidade,
        custoUnitario: material.custoMedio,
        data: dia,
        agendamentoId: agendamento.id,
        servicoId: agendamento.servicoId,
      });
    }
  }

  private async travar(tx: TransacaoComTenant, id: string): Promise<MaterialBanco> {
    await tx.$executeRaw`SELECT id FROM material WHERE id = ${id}::uuid FOR UPDATE`;

    const material = await tx.material.findUnique({ where: { id } });
    if (!material) throw this.materialNaoEncontrado();

    return material;
  }

  private async criarMovimentacao(
    tx: TransacaoComTenant,
    dados: {
      materialId: string;
      tipo: 'entrada' | 'consumo' | 'ajuste';
      quantidade: Prisma.Decimal;
      custoUnitario: Prisma.Decimal;
      data: string;
      observacao?: string | null;
      agendamentoId?: string;
      servicoId?: string | null;
    },
  ): Promise<void> {
    await tx.movimentacaoEstoque.create({
      data: {
        id: uuidv7(),
        tenantId: tenantAtual(),
        materialId: dados.materialId,
        tipo: dados.tipo,
        quantidade: dados.quantidade,
        custoUnitario: dados.custoUnitario,
        valorTotal: valorMovimentacao(dados.quantidade, dados.custoUnitario),
        data: new Date(`${dados.data}T00:00:00Z`),
        observacao: dados.observacao ?? null,
        agendamentoId: dados.agendamentoId ?? null,
        servicoId: dados.servicoId ?? null,
        usuarioId: obterContextoTenant()?.usuarioId ?? null,
      },
    });
  }

  private async garantirMateriais(
    tx: TransacaoComTenant,
    itens: Array<{ materialId: string }>,
    { exigirAtivos = true } = {},
  ): Promise<void> {
    if (itens.length === 0) return;

    const ids = [...new Set(itens.map((item) => item.materialId))];
    const encontrados = await tx.material.count({
      where: { id: { in: ids }, ...(exigirAtivos ? { ativo: true } : {}) },
    });

    if (encontrados !== ids.length) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: exigirAtivos
          ? 'Um dos materiais não existe ou está desativado.'
          : 'Um dos materiais não existe mais.',
      });
    }
  }

  private async garantirServico(
    tx: TransacaoComTenant,
    servicoId: string,
  ): Promise<{ nome: string }> {
    const servico = await tx.servico.findUnique({
      where: { id: servicoId },
      select: { nome: true },
    });

    if (!servico) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Serviço não encontrado.',
      });
    }

    return servico;
  }

  private async garantirNomeDisponivel(tx: TransacaoComTenant, nome: string): Promise<void> {
    const existente = await tx.material.findFirst({ where: { nome }, select: { id: true } });

    if (existente) {
      throw new ConflictException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: 'Já existe um material com este nome.',
      });
    }
  }

  private materialNaoEncontrado(): NotFoundException {
    return new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Material não encontrado.',
    });
  }

  private paraMaterial(registro: MaterialBanco): Material {
    return {
      id: registro.id,
      nome: registro.nome,
      unidade: registro.unidade as UnidadeMaterial,
      quantidade: paraQuantidade(registro.quantidade),
      custoMedio: registro.custoMedio.toFixed(4),
      valorEmEstoque: valorMovimentacao(
        Prisma.Decimal.max(registro.quantidade, ZERO),
        registro.custoMedio,
      ).toFixed(2),
      estoqueMinimo: registro.estoqueMinimo ? paraQuantidade(registro.estoqueMinimo) : null,
      abaixoDoMinimo:
        registro.estoqueMinimo !== null && registro.quantidade.lte(registro.estoqueMinimo),
      ativo: registro.ativo,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}

/** O dia do compromisso no fuso da empresa, e não em UTC. */
export function diaEmSaoPaulo(instante: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(instante);
}
