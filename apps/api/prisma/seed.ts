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
 * Preços e limites ainda não estão definidos comercialmente (arquitetura §12) —
 * estes valores são um ponto de partida para desenvolver, não uma decisão de
 * negócio. `slug` é o identificador estável usado no código; o `nome` pode
 * mudar sem quebrar nada.
 */
const PLANOS = [
  {
    slug: 'essencial',
    nome: 'Essencial',
    preco: '97.00',
    limiteUsuarios: 3,
    limiteClientes: 500,
    limiteEnviosMensais: 300,
  },
  {
    slug: 'profissional',
    nome: 'Profissional',
    preco: '197.00',
    limiteUsuarios: 10,
    limiteClientes: 3000,
    limiteEnviosMensais: 2000,
  },
  {
    slug: 'ilimitado',
    nome: 'Ilimitado',
    preco: '397.00',
    // null significa sem limite — diferente de zero, que bloquearia tudo.
    limiteUsuarios: null,
    limiteClientes: null,
    limiteEnviosMensais: null,
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
        limiteUsuarios: plano.limiteUsuarios,
        limiteClientes: plano.limiteClientes,
        limiteEnviosMensais: plano.limiteEnviosMensais,
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
