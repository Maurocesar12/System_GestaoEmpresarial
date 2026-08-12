import { Prisma } from '../../generated/prisma/client';
import { obterContextoTenant } from '../tenant/tenant-context';

/**
 * Camada 2 do isolamento (arquitetura §4.2): carimba o tenant nas operações do
 * Prisma automaticamente.
 *
 * O ganho principal é ergonômico. Sem isto, todo `create` precisaria repetir
 * `tenantId` e todo `findMany` precisaria repetir `where: { tenantId }` — e um
 * dia alguém esqueceria. Com isto, esquecer deixa de ser possível, porque não
 * há nada para lembrar.
 *
 * Ela **não** é a garantia de segurança: essa é a RLS no banco (camada 3), que
 * vale mesmo se este código tiver bug. As duas juntas é que formam a defesa em
 * profundidade — para vazar dado seria preciso furar as três camadas ao mesmo
 * tempo.
 */

/**
 * Modelos que não pertencem a um tenant.
 *
 * - `Plano` é o catálogo do produto, igual para todas as empresas.
 * - `Tenant` é a própria empresa: sua coluna de identidade é `id`, não
 *   `tenantId`, e quem a protege é a política de RLS específica dela.
 */
const MODELOS_GLOBAIS = new Set<string>(['Plano', 'Tenant']);

/** Operações cujo `where` deve ser restringido ao tenant. */
const OPERACOES_COM_FILTRO = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operações que gravam e precisam receber o `tenantId`. */
const OPERACOES_DE_CRIACAO = new Set<string>(['create', 'createMany', 'createManyAndReturn']);

type ArgsComWhere = { where?: Record<string, unknown> };
type ArgsComData = { data?: Record<string, unknown> | Record<string, unknown>[] };

/**
 * Carimba o tenant no registro a ser criado.
 *
 * Se o chamador já informou um `tenantId`, ele **precisa** ser o do contexto.
 * Divergência não é corrigida em silêncio: seria trocar o dado que o
 * desenvolvedor escreveu por outro sem avisar, e o bug sobreviveria escondido.
 * Melhor falhar alto, na hora, com a mensagem dizendo o que houve.
 */
function aplicarTenant(
  registro: Record<string, unknown>,
  tenantId: string,
  model: string,
): Record<string, unknown> {
  const informado = registro['tenantId'];

  if (typeof informado === 'string' && informado !== tenantId) {
    throw new Error(
      `Tentativa de gravar ${model} com tenantId "${informado}" enquanto o contexto ` +
        `da requisição é "${tenantId}". Um registro só pode ser criado dentro da própria empresa.`,
    );
  }

  return { ...registro, tenantId };
}

export function criarExtensaoTenant() {
  return Prisma.defineExtension({
    name: 'escopo-de-tenant',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (MODELOS_GLOBAIS.has(model)) {
            return query(args);
          }

          const contexto = obterContextoTenant();

          // Sem contexto, seguimos sem carimbar nada. Não é uma brecha: a RLS
          // não devolve nem aceita linha nenhuma quando o tenant da sessão não
          // foi definido. Deixar passar aqui mantém um único lugar responsável
          // por barrar — o banco — em vez de dois com regras que podem divergir.
          if (!contexto) {
            return query(args);
          }

          const { tenantId } = contexto;

          if (OPERACOES_COM_FILTRO.has(operation)) {
            const argsTipados = (args ?? {}) as ArgsComWhere;
            return query({
              ...argsTipados,
              where: { ...argsTipados.where, tenantId },
            });
          }

          if (OPERACOES_DE_CRIACAO.has(operation)) {
            const argsTipados = (args ?? {}) as ArgsComData;
            const { data } = argsTipados;

            // `createMany` recebe um array; `create`, um objeto só.
            const dataComTenant = Array.isArray(data)
              ? data.map((item) => aplicarTenant(item, tenantId, model))
              : aplicarTenant(data ?? {}, tenantId, model);

            return query({ ...argsTipados, data: dataComTenant });
          }

          // `findUnique`, `update` e `delete` ficam de fora de propósito: eles
          // buscam por chave única, e o Prisma não aceita um campo extra no
          // `where` dessas operações. Quem os protege é a RLS — uma linha de
          // outra empresa simplesmente não é encontrada, mesmo com o id certo.
          return query(args);
        },
      },
    },
  });
}
