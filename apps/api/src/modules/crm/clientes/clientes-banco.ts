import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type Cliente,
  type ClienteFormInput,
  type MotivoIgnorado,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';
import { naoEncontrado } from '../../../common/erros';

/**
 * O cliente entre o banco e a API: filtros, limite do plano, repetidos na
 * importação, funil, campos personalizados e etiquetas.
 *
 * Funções que recebem a transação por parâmetro e não guardam estado — o
 * serviço só as orquestra.
 */

/**
 * Monta o filtro de busca.
 *
 * A busca cobre nome, e-mail e telefone porque é assim que uma pessoa procura
 * um cliente no dia a dia — às vezes lembra o nome, às vezes só tem o número
 * que ligou. Os dígitos do telefone são extraídos para que "(11) 91234" ache
 * o registro guardado como "11912345678".
 */
export function montarFiltro(busca?: string, origem?: string): Prisma.ClienteWhereInput {
  // Anonimizado não é mais cliente de ninguém: continua acessível pelo id,
  // a partir dos orçamentos e lançamentos ligados a ele, mas sai da carteira.
  const where: Prisma.ClienteWhereInput = { anonimizadoEm: null };

  if (origem) {
    where.origem = origem;
  }

  if (busca) {
    const digitos = busca.replace(/\D/g, '');

    where.OR = [
      { nome: { contains: busca, mode: 'insensitive' } },
      { email: { contains: busca, mode: 'insensitive' } },
      ...(digitos.length >= 3 ? [{ telefone: { contains: digitos } }] : []),
    ];
  }

  return where;
}

export async function garantirLimiteClientes(
  tx: TransacaoComTenant,
  tenantId: string,
  quantidade = 1,
): Promise<void> {
  // Serializa criações concorrentes do mesmo tenant: sem o lock, duas
  // requisições simultâneas poderiam contar "499" e ambas criar o cliente
  // número 500/501.
  await tx.$executeRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;

  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { plano: { select: { limiteClientes: true, nome: true } } },
  });

  if (!tenant) {
    throw naoEncontrado('Empresa não encontrada.');
  }

  const limite = tenant.plano.limiteClientes;

  // Plano sem teto.
  if (limite === null) {
    return;
  }

  const total = await tx.cliente.count({ where: { anonimizadoEm: null } });
  const vagas = Math.max(limite - total, 0);

  if (quantidade > vagas) {
    throw new ForbiddenException({
      codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
      mensagem:
        quantidade === 1
          ? `O plano ${tenant.plano.nome} permite até ${limite} cliente(s). Faça upgrade para cadastrar mais.`
          : `O plano ${tenant.plano.nome} permite até ${limite} cliente(s) e ainda cabem ${vagas}. ` +
            `A planilha tem ${quantidade}. Nada foi importado.`,
    });
  }
}

/**
 * Documentos e e-mails que já existem entre os enviados.
 *
 * Consulta os dois campos de uma vez e devolve conjuntos, para a checagem por
 * linha custar O(1) em memória em vez de uma ida ao banco.
 */
export async function buscarRepetidos(
  tx: TransacaoComTenant,
  clientes: ClienteFormInput[],
): Promise<{ documentos: Set<string>; emails: Set<string> }> {
  const documentos = clientes
    .map((cliente) => cliente.documento)
    .filter((valor): valor is string => Boolean(valor));

  const emails = clientes
    .map((cliente) => cliente.email)
    .filter((valor): valor is string => Boolean(valor));

  if (documentos.length === 0 && emails.length === 0) {
    return { documentos: new Set(), emails: new Set() };
  }

  const existentes = await tx.cliente.findMany({
    where: {
      OR: [
        ...(documentos.length > 0 ? [{ documento: { in: documentos } }] : []),
        ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
      ],
    },
    select: { documento: true, email: true },
  });

  return {
    documentos: new Set(
      existentes.map((cliente) => cliente.documento).filter((valor) => valor !== null),
    ),
    emails: new Set(existentes.map((cliente) => cliente.email).filter((valor) => valor !== null)),
  };
}

/**
 * Decide se a linha deve ser pulada, e por quê.
 *
 * Cliente sem documento e sem e-mail nunca é considerado repetido: dois
 * homônimos são duas pessoas diferentes até prova em contrário, e recusá-los
 * pelo nome esconderia cadastros legítimos.
 */
export function motivoParaIgnorar(
  dados: ClienteFormInput,
  conjuntos: {
    documentosExistentes: Set<string>;
    emailsExistentes: Set<string>;
    documentosVistos: Set<string>;
    emailsVistos: Set<string>;
  },
): MotivoIgnorado | null {
  const { documento, email } = dados;

  if (documento && conjuntos.documentosVistos.has(documento)) return 'repetido_no_arquivo';
  if (email && conjuntos.emailsVistos.has(email)) return 'repetido_no_arquivo';
  if (documento && conjuntos.documentosExistentes.has(documento)) return 'documento_repetido';
  if (email && conjuntos.emailsExistentes.has(email)) return 'email_repetido';

  return null;
}

/**
 * Coloca o lote inteiro na primeira etapa do funil.
 *
 * Duas consultas para qualquer quantidade, contra duas **por cliente** se
 * `colocarNaPrimeiraEtapa` fosse chamado em laço. Os clientes acabaram de ser
 * criados nesta transação, então não há como já estarem no funil — a
 * verificação que a versão individual faz não é necessária aqui.
 */
export async function colocarLoteNoFunil(
  tx: TransacaoComTenant,
  clienteIds: string[],
): Promise<void> {
  const primeira = await tx.etapaFunil.findFirst({
    orderBy: { ordem: 'asc' },
    select: { id: true },
  });

  // Empresa sem etapas simplesmente não tem funil; a importação não pode
  // falhar por isso.
  if (!primeira) {
    return;
  }

  await tx.clienteFunil.createMany({
    data: clienteIds.map((clienteId) => ({
      id: uuidv7(),
      tenantId: tenantAtual(),
      clienteId,
      etapaId: primeira.id,
    })),
  });
}

/**
 * Converte o registro do banco no formato da API.
 *
 * Datas viram string ISO: `Date` não sobrevive à serialização JSON de forma
 * previsível, e o frontend precisa de um formato estável para exibir.
 */
export function paraResposta(
  registro: Prisma.ClienteGetPayload<object> & { etiquetas?: Array<{ etiquetaId: string }> },
): Cliente {
  return {
    id: registro.id,
    nome: registro.nome,
    email: registro.email,
    telefone: registro.telefone,
    documento: registro.documento,
    observacoes: registro.observacoes,
    origem: registro.origem,
    utmSource: registro.utmSource,
    utmMedium: registro.utmMedium,
    utmCampaign: registro.utmCampaign,
    camposPersonalizados: registro.camposPersonalizados as Record<string, string>,
    etiquetas: registro.etiquetas?.map((item) => item.etiquetaId) ?? [],
    anonimizadoEm: registro.anonimizadoEm?.toISOString() ?? null,
    criadoEm: registro.criadoEm.toISOString(),
    atualizadoEm: registro.atualizadoEm.toISOString(),
  };
}

export function paraBancoCliente(dados: ClienteFormInput) {
  const { etiquetas: _etiquetas, ...campos } = dados;
  return campos;
}

export async function garantirPersonalizacao(
  tx: TransacaoComTenant,
  dados: ClienteFormInput,
): Promise<void> {
  const definicoes = await tx.campoPersonalizado.findMany();
  const porId = new Map(definicoes.map((item) => [item.id, item]));
  for (const [id, valor] of Object.entries(dados.camposPersonalizados)) {
    const campo = porId.get(id);
    if (!campo)
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: 'Um campo personalizado não existe mais.',
      });
    if (valor && campo.tipo === 'numero' && !Number.isFinite(Number(valor.replace(',', '.'))))
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: `${campo.nome} precisa ser um número.`,
      });
    if (valor && campo.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(valor))
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: `${campo.nome} precisa ser uma data válida.`,
      });
    if (valor && campo.tipo === 'selecao' && !campo.opcoes.includes(valor))
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: `Escolha uma opção válida para ${campo.nome}.`,
      });
  }
  const faltando = definicoes.find(
    (item) => item.obrigatorio && !dados.camposPersonalizados[item.id]?.trim(),
  );
  if (faltando)
    throw new BadRequestException({
      codigo: CODIGOS_ERRO.VALIDACAO,
      mensagem: `Preencha o campo obrigatório ${faltando.nome}.`,
    });

  const ids = dados.etiquetas;
  if (!ids.length) return;
  const total = await tx.etiqueta.count({ where: { id: { in: ids } } });
  if (total !== new Set(ids).size) {
    throw naoEncontrado('Uma das etiquetas não existe.');
  }
}

export async function salvarEtiquetas(
  tx: TransacaoComTenant,
  clienteId: string,
  ids: string[],
): Promise<void> {
  await tx.clienteEtiqueta.deleteMany({ where: { clienteId } });
  if (ids.length) {
    await tx.clienteEtiqueta.createMany({
      data: [...new Set(ids)].map((etiquetaId) => ({
        tenantId: tenantAtual(),
        clienteId,
        etiquetaId,
      })),
    });
  }
}
