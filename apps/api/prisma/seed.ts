import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Dados-semente.
 *
 * Popula apenas o que é do produto e igual para todo mundo: o catálogo de
 * planos. Não cria empresa nem usuário — cada tenant nasce zerado no cadastro
 * self-service (arquitetura §1), levando consigo as etapas do funil definidas
 * em `ETAPAS_FUNIL_PADRAO`.
 *
 * Rode com: pnpm --filter @gestao/api db:seed
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Etapas do funil criadas para cada empresa nova (arquitetura §7).
 *
 * Exportado daqui para que o OnboardingModule use exatamente esta lista — se
 * ela vivesse duplicada em dois lugares, um dia divergiria.
 */
export const ETAPAS_FUNIL_PADRAO = [
  'Novo contato',
  'Diagnóstico',
  'Orçamento enviado',
  'Follow-up',
  'Fechado',
  'Serviço executado',
  'Pós-venda',
] as const;

/**
 * Planos oficiais.
 *
 * Existem apenas dois planos vendáveis. Os slugs foram preservados para que
 * empresas já cadastradas não percam a referência quando o nome comercial muda.
 */
const PLANOS = [
  {
    slug: 'essencial',
    nome: 'Básico',
    preco: '100.00',
    descricao: 'Para organizar CRM, agenda, clientes e financeiro com previsões gratuitas limitadas.',
    nivel: 1,
    destaque: false,
    usuariosInclusos: 2,
    precoUsuarioAdicional: '20.00',
    limiteUsuarios: 5,
    limiteClientes: 500,
    limiteEnviosMensais: 300,
    iaHabilitada: false,
    limitePrevisoesIaMensais: 3,
    ativo: true,
  },
  {
    slug: 'profissional',
    nome: 'Premium',
    preco: '200.00',
    descricao: 'Para empresas que querem mais usuários, mais clientes e previsões financeiras com IA em volume.',
    nivel: 2,
    destaque: true,
    usuariosInclusos: 5,
    precoUsuarioAdicional: '15.00',
    limiteUsuarios: 20,
    limiteClientes: 3000,
    limiteEnviosMensais: 2000,
    iaHabilitada: true,
    limitePrevisoesIaMensais: 200,
    ativo: true,
  },
] as const;

async function main(): Promise<void> {
  console.log('Populando planos...');

  for (const plano of PLANOS) {
    // `upsert` pelo slug torna o seed repetível: rodar de novo atualiza preço e
    // limites em vez de estourar erro de chave duplicada.
    await prisma.plano.upsert({
      where: { slug: plano.slug },
      create: { ...plano },
      update: {
        nome: plano.nome,
        preco: plano.preco,
        descricao: plano.descricao,
        nivel: plano.nivel,
        destaque: plano.destaque,
        usuariosInclusos: plano.usuariosInclusos,
        precoUsuarioAdicional: plano.precoUsuarioAdicional,
        limiteUsuarios: plano.limiteUsuarios,
        limiteClientes: plano.limiteClientes,
        limiteEnviosMensais: plano.limiteEnviosMensais,
        iaHabilitada: plano.iaHabilitada,
        limitePrevisoesIaMensais: plano.limitePrevisoesIaMensais,
        ativo: plano.ativo,
      },
    });

    console.log(`  ${plano.nome} — R$ ${plano.preco}`);
  }

  await prisma.plano.updateMany({
    where: { slug: { notIn: PLANOS.map((plano) => plano.slug) } },
    data: { ativo: false, destaque: false },
  });

  console.log('\nPronto.');
}

main()
  .catch((erro: unknown) => {
    console.error('Seed falhou:', erro);
    // Sem isto o processo terminaria com código 0 e um seed quebrado passaria
    // despercebido no CI.
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
