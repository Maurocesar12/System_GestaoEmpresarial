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
  Settings,
  Users,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { possuiPermissao, type Permissao, type UsuarioAutenticado } from '@gestao/shared-types';

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
  /** `null` significa visível para qualquer usuário autenticado. */
  permissao: Permissao | null;
}

export interface GrupoMenu {
  /** `null` no primeiro grupo: o item de visão geral não precisa de rótulo. */
  titulo: string | null;
  itens: readonly ItemMenu[];
}

export const MENU: readonly GrupoMenu[] = [
  {
    titulo: null,
    itens: [{ href: '/painel', rotulo: 'Início', icone: LayoutDashboard, permissao: null }],
  },
  {
    titulo: 'Relacionamento',
    itens: [
      {
        href: '/painel/clientes',
        rotulo: 'Clientes',
        icone: Contact,
        permissao: 'clientes.visualizar',
      },
      {
        href: '/painel/funil',
        rotulo: 'Funil',
        icone: KanbanSquare,
        permissao: 'funil.visualizar',
      },
      {
        href: '/painel/lembretes',
        rotulo: 'Lembretes',
        icone: Bell,
        permissao: 'lembretes.visualizar',
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
        permissao: 'orcamentos.visualizar',
      },
      {
        href: '/painel/agenda',
        rotulo: 'Agenda',
        icone: CalendarDays,
        permissao: 'agenda.visualizar',
      },
      {
        href: '/painel/servicos',
        rotulo: 'Serviços',
        icone: Wrench,
        permissao: 'servicos.visualizar',
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
        permissao: 'financeiro.visualizar',
      },
      {
        href: '/painel/financeiro/pro-labore',
        rotulo: 'Pró-labore',
        icone: HandCoins,
        permissao: 'financeiro.visualizar',
      },
      {
        href: '/painel/financeiro/reservas',
        rotulo: 'Reservas',
        icone: PiggyBank,
        permissao: 'financeiro.visualizar',
      },
    ],
  },
  {
    titulo: 'Administração',
    itens: [
      { href: '/painel/equipe', rotulo: 'Equipe', icone: Users, permissao: 'equipe.gerenciar' },
      { href: '/painel/auditoria', rotulo: 'Auditoria', icone: ScrollText, permissao: 'auditoria.visualizar' },
      { href: '/painel/configuracoes', rotulo: 'Configurações', icone: Settings, permissao: 'empresa.configurar' },
    ],
  },
];

/** Grupos que sobram para um papel, já sem os grupos que ficaram vazios. */
export function menuDoUsuario(usuario: UsuarioAutenticado): GrupoMenu[] {
  return MENU.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter(
      (item) => item.permissao === null || possuiPermissao(usuario, item.permissao),
    ),
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
