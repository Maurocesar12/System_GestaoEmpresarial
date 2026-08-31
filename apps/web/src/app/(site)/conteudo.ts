import {
  Bell,
  CalendarDays,
  Contact,
  FileText,
  KanbanSquare,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Texto e dados da página inicial.
 *
 * Separado da página de propósito: ajustar uma frase de venda é o tipo de coisa
 * que acontece toda semana, e não deveria exigir navegar por JSX para achar
 * onde o texto está. Aqui é tudo dado; lá é só apresentação.
 */

export interface Recurso {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

export const RECURSOS: readonly Recurso[] = [
  {
    icone: Contact,
    titulo: 'Clientes com histórico',
    descricao:
      'Cada atendimento fica registrado na ficha do cliente, junto com a origem do contato — indicação, Instagram, anúncio.',
  },
  {
    icone: KanbanSquare,
    titulo: 'Funil de vendas',
    descricao:
      'Etapas configuráveis e quadro para arrastar. Você vê onde cada negociação parou e há quantos dias ela não anda.',
  },
  {
    icone: FileText,
    titulo: 'Orçamentos',
    descricao:
      'Emita a proposta e o cliente entra no funil sozinho. O status acompanha: aberto, aprovado ou recusado.',
  },
  {
    icone: CalendarDays,
    titulo: 'Agenda de serviços',
    descricao:
      'O que foi vendido vira compromisso agendado, com estados que vão de agendado a executado.',
  },
  {
    icone: Bell,
    titulo: 'Follow-up automático',
    descricao:
      'Marque o retorno e o sistema envia o lembrete por e-mail no dia certo, sem depender de alguém lembrar.',
  },
  {
    icone: Wallet,
    titulo: 'Financeiro com margem',
    descricao:
      'Entradas e saídas separadas entre pessoal e empresa, fluxo de caixa e a margem real de cada serviço prestado.',
  },
];

export interface Passo {
  titulo: string;
  descricao: string;
}

/**
 * O encadeamento que sustenta a promessa do produto: cada passo alimenta o
 * seguinte, e é isso que permite calcular margem sem digitação repetida.
 */
export const PASSOS: readonly Passo[] = [
  {
    titulo: 'O contato vira negociação',
    descricao:
      'Você cadastra o cliente e emite o orçamento. Ele entra no funil na hora, sem você mover nada à mão.',
  },
  {
    titulo: 'A venda vira compromisso',
    descricao:
      'Orçamento aprovado vira agendamento, com o serviço do catálogo e o custo-base que ele já carrega.',
  },
  {
    titulo: 'O serviço vira número',
    descricao:
      'Ao lançar o recebimento, receita e custo ficam ligados ao atendimento que os gerou — e a margem sai sozinha.',
  },
];

export interface Plano {
  slug: string;
  nome: string;
  /** Em reais, por mês. */
  preco: string;
  resumo: string;
  limites: readonly string[];
  destaque?: boolean;
}

/**
 * Planos exibidos na página.
 *
 * ATENÇÃO: estes valores espelham `apps/api/prisma/seed.ts`, onde estão
 * marcados como **provisórios** — são um ponto de partida para desenvolver, e
 * não uma decisão comercial (arquitetura §12, "Planos — quantos, quais limites,
 * preço, duração do trial").
 *
 * Antes de o site ir ao ar, preço e limites precisam ser confirmados aqui e no
 * seed, que é quem popula o banco. Divergência entre os dois faz o cliente
 * contratar uma coisa e receber outra.
 */
export const PLANOS: readonly Plano[] = [
  {
    slug: 'essencial',
    nome: 'Essencial',
    preco: '97',
    resumo: 'Para quem está organizando a operação pela primeira vez.',
    limites: ['3 usuários', 'Até 500 clientes', '300 lembretes por mês'],
  },
  {
    slug: 'profissional',
    nome: 'Profissional',
    preco: '197',
    resumo: 'Para equipe formada, com follow-up rodando todos os dias.',
    limites: ['10 usuários', 'Até 3.000 clientes', '2.000 lembretes por mês'],
    destaque: true,
  },
  {
    slug: 'ilimitado',
    nome: 'Ilimitado',
    preco: '397',
    resumo: 'Para operação grande, sem teto de cadastro nem de envio.',
    limites: ['Usuários ilimitados', 'Clientes ilimitados', 'Lembretes ilimitados'],
  },
];

/** Dias de teste — espelha `ONBOARDING_TRIAL_DIAS` no ambiente da API. */
export const DIAS_DE_TESTE = 14;
