import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

/**
 * O que falta preencher para os relatórios pararem de sair vazios.
 *
 * Vários números do produto dependem de um campo que ninguém é obrigado a
 * preencher no cadastro: margem precisa do custo base do serviço, fluxo de
 * caixa precisa da categoria classificada, custo operacional precisa do
 * pró-labore vigente. Sem eles a tela abre, não dá erro, e mostra zero — que é
 * o pior dos mundos, porque parece resposta.
 *
 * Este comando olha os dados de cada empresa e diz o que está faltando.
 *
 *   pnpm --filter @gestao/api diagnostico
 */

/** `orcamento_enviado` e `fechado` — ver o enum `MarcoFunil` no schema. */
const MARCOS_POSSIVEIS = 2;

/** A data como o usuário a vê na tela, para ele achar o lançamento. */
function paraDia(data: Date): string {
  return data.toISOString().slice(0, 10).split('-').reverse().join('/');
}

function exigirConexao(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error('Defina DATABASE_URL em apps/api/.env.');
  }

  return url;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: exigirConexao() }) });

async function comTenant<T>(
  tenantId: string,
  operacao: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
    return operacao(tx);
  });
}

function linha(
  rotulo: string,
  faltam: number,
  total: number,
  porque: string,
  exemplos: string[] = [],
): void {
  if (total === 0) {
    console.log(`  --  ${rotulo}: nada cadastrado — ${porque}`);
    return;
  }

  const marca = faltam === 0 ? 'ok  ' : 'FALTA';
  const detalhe = faltam === 0 ? `${total} preenchido(s)` : `${faltam} de ${total} sem preencher`;

  console.log(`  ${marca} ${rotulo}: ${detalhe}${faltam === 0 ? '' : ` — ${porque}`}`);

  // Saber que faltam três não diz por onde começar. Nomear os registros é o
  // que transforma o diagnóstico numa lista de cliques.
  for (const item of exemplos) {
    console.log(`         · ${item}`);
  }

  if (faltam > exemplos.length) {
    console.log(`         · (+${faltam - exemplos.length} não listado[s])`);
  }
}

/** Até onde vale listar antes de a saída virar parede de texto. */
const MAXIMO_EXEMPLOS = 5;

async function main(): Promise<void> {
  const usuarios = await prisma.usuario.findMany({
    select: { tenantId: true, email: true },
    orderBy: [{ papel: 'asc' }, { criadoEm: 'asc' }],
  });

  const empresas = new Map<string, string>();
  for (const usuario of usuarios) {
    if (!empresas.has(usuario.tenantId)) empresas.set(usuario.tenantId, usuario.email);
  }

  for (const [tenantId, email] of empresas) {
    const dados = await comTenant(tenantId, async (tx) => {
      const [
        tenant,
        servicos,
        servicosSemCusto,
        categoriasSaida,
        lancamentos,
        lancamentosSemCategoria,
        lancamentosSemServico,
        proLabore,
        etapas,
        etapasComMarco,
        clientes,
        clientesSemOrigem,
        materiais,
        fichasTecnicas,
        reservas,
        exemplosSemServico,
        exemplosSemCategoria,
        exemplosSemOrigem,
      ] = await Promise.all([
        tx.tenant.findUnique({ where: { id: tenantId }, select: { nome: true } }),
        tx.servico.count(),
        // `custoBase` não é nulável: quem não informou ficou com zero. Para a
        // margem dá no mesmo — zero de custo significa lucro igual à receita,
        // que é o número errado com cara de número certo.
        tx.servico.count({ where: { custoBase: 0 } }),
        tx.categoriaFinanceira.count(),
        tx.lancamentoFinanceiro.count(),
        tx.lancamentoFinanceiro.count({ where: { categoriaId: null, tipo: 'saida' } }),
        tx.lancamentoFinanceiro.count({ where: { servicoId: null, tipo: 'entrada' } }),
        tx.proLabore.count(),
        tx.etapaFunil.count(),
        // Só existem dois marcos (`orcamento_enviado` e `fechado`), e
        // `@@unique([tenantId, marco])` garante uma etapa para cada. Contar
        // "etapas sem marco" diria que faltam sete num funil perfeitamente
        // configurado — o que importa é se os **dois marcos** têm dono.
        tx.etapaFunil.count({ where: { marco: { not: null } } }),
        tx.cliente.count({ where: { anonimizadoEm: null } }),
        tx.cliente.count({ where: { anonimizadoEm: null, origem: null } }),
        tx.material.count(),
        tx.servicoMaterial.count(),
        tx.reservaFinanceira.count(),
        tx.lancamentoFinanceiro.findMany({
          where: { servicoId: null, tipo: 'entrada' },
          select: { descricao: true, valor: true, data: true },
          orderBy: { data: 'desc' },
          take: MAXIMO_EXEMPLOS,
        }),
        tx.lancamentoFinanceiro.findMany({
          where: { categoriaId: null, tipo: 'saida' },
          select: { descricao: true, valor: true, data: true },
          orderBy: { data: 'desc' },
          take: MAXIMO_EXEMPLOS,
        }),
        tx.cliente.findMany({
          where: { anonimizadoEm: null, origem: null },
          select: { nome: true },
          orderBy: { criadoEm: 'desc' },
          take: MAXIMO_EXEMPLOS,
        }),
      ]);

      return {
        nome: tenant?.nome ?? '?',
        exemplosSemServico: exemplosSemServico.map(
          (item) => `${paraDia(item.data)} · ${item.descricao} · R$ ${item.valor.toFixed(2)}`,
        ),
        exemplosSemCategoria: exemplosSemCategoria.map(
          (item) => `${paraDia(item.data)} · ${item.descricao} · R$ ${item.valor.toFixed(2)}`,
        ),
        exemplosSemOrigem: exemplosSemOrigem.map((item) => item.nome),
        servicos,
        servicosSemCusto,
        categoriasSaida,
        lancamentos,
        lancamentosSemCategoria,
        lancamentosSemServico,
        proLabore,
        etapas,
        etapasComMarco,
        clientes,
        clientesSemOrigem,
        materiais,
        fichasTecnicas,
        reservas,
      };
    });

    console.log(`\n=== ${dados.nome}  ·  ${email} ===`);

    linha(
      'Custo base dos serviços',
      dados.servicosSemCusto,
      dados.servicos,
      'sem ele o relatório de margem não tem o que comparar',
    );
    linha(
      'Receita ligada ao serviço',
      dados.lancamentosSemServico,
      dados.lancamentos,
      'entrada sem serviço não entra na margem por serviço',
      dados.exemplosSemServico,
    );
    linha(
      'Saídas categorizadas',
      dados.lancamentosSemCategoria,
      dados.lancamentos,
      'saída sem categoria vira "não classificado" e fica fora de custo fixo/variável',
      dados.exemplosSemCategoria,
    );
    linha(
      'Origem dos clientes',
      dados.clientesSemOrigem,
      dados.clientes,
      'é o que faz o relatório de marketing por origem valer alguma coisa',
      dados.exemplosSemOrigem,
    );
    linha(
      'Marcos do funil (2 possíveis)',
      MARCOS_POSSIVEIS - dados.etapasComMarco,
      MARCOS_POSSIVEIS,
      'sem marco, o cliente não anda sozinho quando a proposta é enviada ou aprovada',
    );

    console.log(
      `  --  Pró-labore: ${dados.proLabore === 0 ? 'NENHUM registrado — o custo por dia sai só com custo fixo' : `${dados.proLabore} registro(s)`}`,
    );
    console.log(
      `  --  Reservas: ${dados.reservas === 0 ? 'nenhuma — impostos e 13º ficam misturados ao caixa livre' : `${dados.reservas}`}`,
    );
    console.log(
      `  --  Estoque: ${dados.materiais} material(is), ${dados.fichasTecnicas} ficha(s) técnica(s)` +
        `${dados.materiais > 0 && dados.fichasTecnicas === 0 ? ' — material cadastrado mas nenhum ligado a serviço, então não baixa sozinho' : ''}`,
    );
    console.log(`  --  Categorias financeiras: ${dados.categoriasSaida}`);
  }
}

main()
  .catch((erro: unknown) => {
    console.error(`\n✖ ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
