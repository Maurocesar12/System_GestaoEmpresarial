import {
  MIME_TYPES_ANEXO_LANCAMENTO,
  statusDoLancamento,
  type Lancamento,
  type LancamentoFormInput,
  type LancamentosQuery,
  type PeriodoQuery,
  type StatusLancamento,
} from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import { Prisma } from '../../generated/prisma/client';
import { type TransacaoComTenant } from '../../infra/prisma/prisma.service';
import { tenantAtual } from '../../infra/tenant/tenant-context';
import { type AnexoConferido } from './conferencia-anexo';
import { hojeEmDia, paraData, paraDia } from './datas';

/**
 * O lançamento entre o banco e a API: filtros, colunas gravadas e a resposta.
 *
 * Funções puras, usadas pelo serviço de lançamentos e pelos relatórios. Ficam
 * fora do serviço para que a tradução de um registro seja uma só, em um lugar.
 */

/**
 * Traduz a situação — que é derivada — para um filtro que o banco entende.
 *
 * Precisa existir porque não há coluna `status` para o `where` apontar. A
 * tradução é a mesma regra de `statusDoLancamento`, escrita na linguagem do
 * Prisma; as duas são cobertas pelos testes de integração justamente para não
 * divergirem.
 */
export function filtroDeStatus(status: StatusLancamento): Prisma.LancamentoFinanceiroWhereInput {
  if (status === 'pago') {
    return { pagoEm: { not: null } };
  }

  if (status === 'atrasado') {
    return { pagoEm: null, vencimento: { lt: new Date(`${hojeEmDia()}T00:00:00Z`) } };
  }

  // A vencer: em aberto e ainda no prazo — incluindo o que não tem vencimento,
  // que nunca fica atrasado.
  return {
    pagoEm: null,
    OR: [{ vencimento: null }, { vencimento: { gte: new Date(`${hojeEmDia()}T00:00:00Z`) } }],
  };
}

export const RELACIONAMENTOS_PADRAO = {
  categoria: { select: { nome: true } },
  servico: { select: { nome: true } },
  cliente: { select: { nome: true } },
} as const;

export const INCLUDE_RESUMO = {
  ...RELACIONAMENTOS_PADRAO,
  anexos: {
    select: {
      id: true,
      nome: true,
      mimeType: true,
      tamanhoBytes: true,
      criadoEm: true,
    },
    orderBy: { criadoEm: 'asc' },
  },
} as const;

export const INCLUDE_COMPLETO = {
  ...RELACIONAMENTOS_PADRAO,
  anexos: { orderBy: { criadoEm: 'asc' } },
} as const;

/**
 * O registro como ele volta do banco, derivado do próprio schema.
 *
 * Escrever este tipo à mão significaria mantê-lo sincronizado com o Prisma na
 * unha, e o TypeScript não avisaria quando os dois divergissem.
 */
export type LancamentoBanco =
  | Prisma.LancamentoFinanceiroGetPayload<{
      include: typeof INCLUDE_RESUMO;
    }>
  | Prisma.LancamentoFinanceiroGetPayload<{
      include: typeof INCLUDE_COMPLETO;
    }>;

/**
 * O recorte de período compartilhado pelos dois relatórios.
 *
 * Filtra por `pagoEm`, e não por `data`. A diferença é o ponto inteiro das
 * contas a receber: fluxo de caixa mede dinheiro que se moveu, e uma conta em
 * aberto — por definição — não moveu. Somá-la faria o saldo do mês mostrar
 * dinheiro que ainda não está na conta.
 *
 * Como consequência, `pagoEm: null` fica de fora: lançamento em aberto não
 * entra em caixa nem em margem até a baixa.
 */
export function filtroDePeriodo(query: PeriodoQuery): Prisma.LancamentoFinanceiroWhereInput {
  return {
    pagoEm: {
      gte: new Date(`${query.de}T00:00:00Z`),
      lte: new Date(`${query.ate}T23:59:59.999Z`),
    },
    natureza: query.natureza ?? 'empresa',
    ...(query.categoriaId ? { categoriaId: query.categoriaId } : {}),
  };
}

export function montarFiltro(query: LancamentosQuery): Prisma.LancamentoFinanceiroWhereInput {
  const where: Prisma.LancamentoFinanceiroWhereInput = {};

  if (query.tipo) where.tipo = query.tipo;
  if (query.natureza) where.natureza = query.natureza;
  if (query.categoriaId) where.categoriaId = query.categoriaId;
  if (query.servicoId) where.servicoId = query.servicoId;
  if (query.status) Object.assign(where, filtroDeStatus(query.status));

  if (query.de || query.ate) {
    where.data = {
      ...(query.de ? { gte: new Date(`${query.de}T00:00:00Z`) } : {}),
      ...(query.ate ? { lte: new Date(`${query.ate}T23:59:59.999Z`) } : {}),
    };
  }

  return where;
}

/**
 * As colunas gravadas, iguais no `create` e no `update`.
 *
 * A data chega como `YYYY-MM-DD` e é fixada em meia-noite UTC. Sem o `Z`, o
 * servidor interpretaria no fuso dele e a data mudaria de dia conforme onde a
 * aplicação estivesse rodando.
 */
export function paraBanco(dados: LancamentoFormInput) {
  return {
    tipo: dados.tipo,
    natureza: dados.natureza,
    descricao: dados.descricao,
    valor: dados.valor,
    data: new Date(`${dados.data}T00:00:00Z`),
    vencimento: paraData(dados.vencimento),
    pagoEm: paraData(dados.pagoEm),
    categoriaId: dados.categoriaId,
    servicoId: dados.servicoId,
    clienteId: dados.clienteId,
  };
}

/**
 * Grava os anexos já conferidos por `conferirAnexos`.
 *
 * A conferência acontece antes da transação, em quem chama: recodificar
 * imagem e abrir PDF levam centenas de milissegundos, e segurar a transação
 * do banco esse tempo todo atrasaria as outras requisições. E um arquivo
 * recusado ali nunca chega a apagar os anexos que o lançamento já tinha.
 */
export async function substituirAnexos(
  tx: TransacaoComTenant,
  lancamentoId: string,
  conferidos: AnexoConferido[],
): Promise<void> {
  await tx.anexoLancamento.deleteMany({ where: { lancamentoId } });

  if (conferidos.length === 0) {
    return;
  }

  await tx.anexoLancamento.createMany({
    // O id é sempre do servidor. O que vinha do corpo era aceito como chave
    // primária — e um id de outra empresa batia na unicidade e revelava que
    // aquele anexo existia.
    data: conferidos.map((anexo) => ({
      id: uuidv7(),
      tenantId: tenantAtual(),
      lancamentoId,
      ...anexo,
    })),
  });
}

export function paraResposta(registro: LancamentoBanco): Lancamento {
  const vencimento = paraDia(registro.vencimento);
  const pagoEm = paraDia(registro.pagoEm);

  return {
    id: registro.id,
    tipo: registro.tipo,
    natureza: registro.natureza,
    descricao: registro.descricao,
    valor: registro.valor.toFixed(2),
    data: registro.data.toISOString().slice(0, 10),
    vencimento,
    pagoEm,
    // Calculado na resposta, com a mesma função que a tela usa — em vez de
    // gravado numa coluna que envelheceria à meia-noite.
    status: statusDoLancamento(vencimento, pagoEm, hojeEmDia()),
    categoriaId: registro.categoriaId,
    categoriaNome: registro.categoria?.nome ?? null,
    servicoId: registro.servicoId,
    servicoNome: registro.servico?.nome ?? null,
    clienteId: registro.clienteId,
    clienteNome: registro.cliente?.nome ?? null,
    // As três colunas andam juntas por restrição do banco, mas o TypeScript
    // não sabe disso — a checagem aqui é o que converte "três nulos
    // independentes" no objeto único que a tela espera.
    parcelamento:
      registro.grupoId && registro.parcela && registro.totalParcelas
        ? {
            grupoId: registro.grupoId,
            parcela: registro.parcela,
            total: registro.totalParcelas,
          }
        : null,
    recorrenciaId: registro.recorrenciaId,
    anexos: registro.anexos.map((anexo) => ({
      id: anexo.id,
      nome: anexo.nome,
      mimeType: anexo.mimeType as (typeof MIME_TYPES_ANEXO_LANCAMENTO)[number],
      tamanhoBytes: anexo.tamanhoBytes,
      conteudo: 'conteudo' in anexo ? anexo.conteudo : undefined,
      criadoEm: anexo.criadoEm.toISOString(),
    })),
    criadoEm: registro.criadoEm.toISOString(),
  };
}

export function paraAuditoria(registro: LancamentoBanco) {
  const resposta = paraResposta(registro);

  return {
    ...resposta,
    anexos: resposta.anexos.map(({ conteudo: _conteudo, ...anexo }) => anexo),
  };
}

export function resumirLancamento(prefixo: string, registro: LancamentoBanco): string {
  const tipo = registro.tipo === 'entrada' ? 'entrada' : 'saída';
  const natureza = registro.natureza === 'pessoal' ? 'pessoal' : 'empresa';
  const cliente = registro.cliente?.nome ? ` · cliente: ${registro.cliente.nome}` : '';

  return `${prefixo}: ${registro.descricao} · ${tipo} ${natureza} · R$ ${registro.valor.toFixed(2)}${cliente}`;
}
