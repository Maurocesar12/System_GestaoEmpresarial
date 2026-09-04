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
 * Planos iniciais.
 *
 * Os slugs anteriores foram preservados para que empresas já cadastradas não
 * percam a referência ao plano quando o nome comercial muda.
 */
const PLANOS = [
  {
    slug: 'essencial',
    nome: 'Básico',
    preco: '100.00',
    usuariosInclusos: 2,
    precoUsuarioAdicional: '20.00',
    limiteUsuarios: 5,
    limiteClientes: 500,
    limiteEnviosMensais: 300,
    iaHabilitada: false,
    limitePrevisoesIaMensais: 0,
    ativo: true,
  },
  {
    slug: 'profissional',
    nome: 'Pro',
    preco: '200.00',
    usuariosInclusos: 5,
    precoUsuarioAdicional: '15.00',
    limiteUsuarios: 20,
    limiteClientes: 3000,
    limiteEnviosMensais: 2000,
    iaHabilitada: true,
    limitePrevisoesIaMensais: 200,
    ativo: true,
  },
  {
    slug: 'ilimitado',
    nome: 'Ilimitado',
    preco: '397.00',
    // null significa sem limite — diferente de zero, que bloquearia tudo.
    usuariosInclusos: null,
    precoUsuarioAdicional: '0.00',
    limiteUsuarios: null,
    limiteClientes: null,
    limiteEnviosMensais: null,
    iaHabilitada: true,
    limitePrevisoesIaMensais: null,
    ativo: false,
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
