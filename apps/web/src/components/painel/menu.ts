import {
  CalendarDays,
  Contact,
  FileText,
  HandCoins,
  KanbanSquare,
  LayoutDashboard,
  Bell,
  PiggyBank,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { PapelUsuario } from '@gestao/shared-types';

/**
 * Estrutura do menu do painel.
 *
 * Os itens são agrupados por assunto porque uma lista corrida de oito links faz
 * o usuário reler tudo a cada navegação. Agrupado, ele aprende onde as coisas
 * ficam e passa a mirar direto.
 *
 * O filtro por papel (arquitetura §9.5) é **cortesia com o usuário**: não
 * mostrar o que ele não pode abrir. A proteção de verdade está nos guards da
 * API, que recusam a requisição mesmo se alguém digitar a URL na barra de
 * endereço. Por isso não há problema em o navegador conhecer a lista inteira.
 */
export interface ItemMenu {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** `null` significa visível para qualquer papel. */
  papeis: readonly PapelUsuario[] | null;
}

export interface GrupoMenu {
  /** `null` no primeiro grupo: o item de visão geral não precisa de rótulo. */
  titulo: string | null;
  itens: readonly ItemMenu[];
}

const TODOS_MENOS_FINANCEIRO = ['admin', 'atendente', 'tecnico'] as const;

export const MENU: readonly GrupoMenu[] = [
  {
    titulo: null,
    itens: [{ href: '/painel', rotulo: 'Início', icone: LayoutDashboard, papeis: null }],
  },
  {
    titulo: 'Relacionamento',
    itens: [
      {
        href: '/painel/clientes',
        rotulo: 'Clientes',
        icone: Contact,
        papeis: TODOS_MENOS_FINANCEIRO,
      },
      {
        href: '/painel/funil',
        rotulo: 'Funil',
        icone: KanbanSquare,
        papeis: TODOS_MENOS_FINANCEIRO,
      },
      {
        href: '/painel/lembretes',
        rotulo: 'Lembretes',
        icone: Bell,
        papeis: TODOS_MENOS_FINANCEIRO,
      },
    ],
  },
  {
    titulo: 'Operação',
    itens: [
      {
        href: '/painel/orcamentos',
        rotulo: 'Orçamentos',
        icone: FileText,
        papeis: TODOS_MENOS_FINANCEIRO,
      },
      {
        href: '/painel/agenda',
        rotulo: 'Agenda',
        icone: CalendarDays,
        papeis: TODOS_MENOS_FINANCEIRO,
      },
      {
        href: '/painel/servicos',
        rotulo: 'Serviços',
        icone: Wrench,
        papeis: ['admin', 'financeiro', 'atendente', 'tecnico'],
      },
    ],
  },
  {
    titulo: 'Financeiro',
    // Restrito (§9.5): o dono precisa poder dar acesso ao sistema sem expor o
    // quanto ganha — e o pró-labore é justamente o número mais sensível disso.
    itens: [
      {
        href: '/painel/financeiro',
        rotulo: 'Movimento',
        icone: Wallet,
        papeis: ['admin', 'financeiro'],
      },
      {
        href: '/painel/financeiro/pro-labore',
        rotulo: 'Pró-labore',
        icone: HandCoins,
        papeis: ['admin', 'financeiro'],
      },
      {
        href: '/painel/financeiro/reservas',
        rotulo: 'Reservas',
        icone: PiggyBank,
        papeis: ['admin', 'financeiro'],
      },
    ],
  },
];

/** Grupos que sobram para um papel, já sem os grupos que ficaram vazios. */
export function menuDoPapel(papel: PapelUsuario): GrupoMenu[] {
  return MENU.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => item.papeis === null || item.papeis.includes(papel)),
  })).filter((grupo) => grupo.itens.length > 0);
}

/**
 * Qual item do menu representa a tela aberta.
 *
 * Devolve **um** href, o mais específico entre os que casam. Isso importa desde
 * que o financeiro ganhou subitens: `/painel/financeiro/reservas` casa tanto
 * com "Movimento" quanto com "Reservas", e marcar por prefixo acenderia os dois
 * ao mesmo tempo — inclusive para o leitor de tela, que anunciaria duas páginas
 * atuais.
 *
 * Escolher o href mais longo resolve o caso geral: vale para o financeiro de
 * hoje e para qualquer subitem que venha depois, sem lista de exceções. O
 * `/painel` só vence quando nada mais casa, que é exatamente o que se espera de
 * um item raiz.
 */
export function hrefAtivo(grupos: readonly GrupoMenu[], caminhoAtual: string): string | null {
  let escolhido: string | null = null;

  for (const grupo of grupos) {
    for (const item of grupo.itens) {
      const casa = caminhoAtual === item.href || caminhoAtual.startsWith(`${item.href}/`);

      if (casa && (escolhido === null || item.href.length > escolhido.length)) {
        escolhido = item.href;
      }
    }
  }

  return escolhido;
}
