import { z } from 'zod';
import { PAPEIS_USUARIO, type PapelUsuario } from '../enums';
import { PERMISSOES, PERMISSOES_PADRAO_POR_PAPEL, type Permissao } from './permissoes';

/**
 * Acesso por área: a forma de configurar permissões que as pessoas entendem.
 *
 * Ninguém decide acesso lendo 32 permissões soltas. A pergunta real é "o
 * técnico vê a agenda? mexe no financeiro?". Cada área tem níveis acumulados
 * (ver ⊂ editar ⊂ total) e, à parte, extras que não cabem numa escada — como
 * a exportação LGPD, que é sensível demais para vir junto com "editar".
 *
 * Os níveis tornam impossível a combinação sem sentido que as caixinhas
 * permitiam, como editar clientes sem poder vê-los.
 *
 * Quem converte níveis em permissões é a API (`permissoesDosAcessos`). A tela
 * recebe o catálogo e os níveis atuais prontos, e devolve a escolha.
 */

export const AREAS_ACESSO_IDS = [
  'clientes',
  'funil',
  'orcamentos',
  'agenda',
  'lembretes',
  'servicos',
  'estoque',
  'financeiro',
  'ia',
  'marketing',
  'administracao',
] as const;

export type AreaAcessoId = (typeof AREAS_ACESSO_IDS)[number];

export const NIVEIS_ACESSO = ['nenhum', 'ver', 'editar', 'total'] as const;
export type NivelAcesso = (typeof NIVEIS_ACESSO)[number];

export interface NivelDaArea {
  nivel: Exclude<NivelAcesso, 'nenhum'>;
  rotulo: string;
  /** O que a pessoa consegue fazer neste nível, em uma frase. */
  descricao: string;
  /** Todas as permissões do nível — já inclui as dos níveis abaixo. */
  permissoes: readonly Permissao[];
}

export interface ExtraDaArea {
  codigo: Permissao;
  rotulo: string;
}

export interface AreaDeAcesso {
  id: AreaAcessoId;
  titulo: string;
  descricao: string;
  /** Do menor para o maior. Vazio: a área só tem extras independentes. */
  niveis: readonly NivelDaArea[];
  /** Ligados à parte. Numa área com níveis, só valem com algum nível. */
  extras: readonly ExtraDaArea[];
}

export const AREAS_ACESSO: readonly AreaDeAcesso[] = [
  {
    id: 'clientes',
    titulo: 'Clientes',
    descricao: 'Cadastro e ficha dos clientes.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta clientes e o histórico.',
        permissoes: ['clientes.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Atualiza dados de clientes existentes.',
        permissoes: ['clientes.visualizar', 'clientes.editar'],
      },
      {
        nivel: 'total',
        rotulo: 'Total',
        descricao: 'Também exclui clientes.',
        permissoes: ['clientes.visualizar', 'clientes.editar', 'clientes.excluir'],
      },
    ],
    extras: [
      { codigo: 'clientes.criar', rotulo: 'Cadastrar novos clientes' },
      { codigo: 'clientes.importar', rotulo: 'Importar planilha de clientes' },
      { codigo: 'clientes.dados_pessoais', rotulo: 'Exportar e anonimizar dados pessoais (LGPD)' },
    ],
  },
  {
    id: 'funil',
    titulo: 'Funil de vendas',
    descricao: 'Etapas da negociação de cada cliente.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Acompanha o quadro.',
        permissoes: ['funil.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Mover',
        descricao: 'Move clientes entre as etapas.',
        permissoes: ['funil.visualizar', 'funil.movimentar'],
      },
      {
        nivel: 'total',
        rotulo: 'Total',
        descricao: 'Também cria, renomeia e reordena as etapas.',
        permissoes: ['funil.visualizar', 'funil.movimentar', 'funil.configurar'],
      },
    ],
    extras: [],
  },
  {
    id: 'orcamentos',
    titulo: 'Orçamentos',
    descricao: 'Propostas enviadas aos clientes.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta orçamentos e valores.',
        permissoes: ['orcamentos.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Emite, edita, aprova e recusa orçamentos.',
        permissoes: ['orcamentos.visualizar', 'orcamentos.gerenciar'],
      },
    ],
    extras: [],
  },
  {
    id: 'agenda',
    titulo: 'Agenda',
    descricao: 'Serviços marcados e executados.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta os compromissos.',
        permissoes: ['agenda.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Agenda, remarca, cancela e marca como executado.',
        permissoes: ['agenda.visualizar', 'agenda.gerenciar'],
      },
    ],
    extras: [],
  },
  {
    id: 'lembretes',
    titulo: 'Lembretes',
    descricao: 'Follow-ups com os clientes.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta os lembretes.',
        permissoes: ['lembretes.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Cria, edita e cancela lembretes.',
        permissoes: ['lembretes.visualizar', 'lembretes.gerenciar'],
      },
    ],
    extras: [],
  },
  {
    id: 'servicos',
    titulo: 'Serviços',
    descricao: 'Catálogo de serviços e preços.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta serviços, custos e preços.',
        permissoes: ['servicos.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Cadastra serviços e define custo, preço e materiais.',
        permissoes: ['servicos.visualizar', 'servicos.gerenciar'],
      },
    ],
    extras: [],
  },
  {
    id: 'estoque',
    titulo: 'Estoque',
    descricao: 'Materiais, entradas e saldos.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta materiais e saldos.',
        permissoes: ['estoque.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Cadastra materiais, registra entradas e ajustes.',
        permissoes: ['estoque.visualizar', 'estoque.gerenciar'],
      },
    ],
    extras: [],
  },
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    descricao: 'Lançamentos, caixa, margem e pró-labore.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta valores e relatórios.',
        permissoes: ['financeiro.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Cria lançamentos, edita e dá baixa.',
        permissoes: ['financeiro.visualizar', 'financeiro.criar', 'financeiro.editar'],
      },
      {
        nivel: 'total',
        rotulo: 'Total',
        descricao: 'Também exclui lançamentos.',
        permissoes: [
          'financeiro.visualizar',
          'financeiro.criar',
          'financeiro.editar',
          'financeiro.excluir',
        ],
      },
    ],
    extras: [
      { codigo: 'financeiro.importar', rotulo: 'Importar planilha de lançamentos' },
      { codigo: 'financeiro.exportar', rotulo: 'Exportar lançamentos' },
    ],
  },
  {
    id: 'ia',
    titulo: 'Inteligência artificial',
    descricao: 'Previsão financeira com IA.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver consumo',
        descricao: 'Acompanha quanto a empresa usou de IA.',
        permissoes: ['ia.visualizar_consumo'],
      },
      {
        nivel: 'editar',
        rotulo: 'Usar',
        descricao: 'Também gera previsões financeiras.',
        permissoes: ['ia.visualizar_consumo', 'ia.previsao_financeira'],
      },
    ],
    extras: [],
  },
  {
    id: 'marketing',
    titulo: 'Marketing',
    descricao: 'Origem dos leads e conversão.',
    niveis: [
      {
        nivel: 'ver',
        rotulo: 'Ver',
        descricao: 'Consulta de onde vêm os leads.',
        permissoes: ['marketing.visualizar'],
      },
      {
        nivel: 'editar',
        rotulo: 'Editar',
        descricao: 'Também gera a chave do formulário do site.',
        permissoes: ['marketing.visualizar', 'marketing.gerenciar'],
      },
    ],
    extras: [],
  },
  {
    id: 'administracao',
    titulo: 'Administração',
    descricao: 'Ajustes da empresa. Cada item é independente.',
    niveis: [],
    extras: [
      { codigo: 'equipe.gerenciar', rotulo: 'Gerenciar equipe e convites' },
      { codigo: 'auditoria.visualizar', rotulo: 'Ver o histórico de alterações' },
      { codigo: 'empresa.configurar', rotulo: 'Configurar a empresa e os campos' },
    ],
  },
];

export interface AcessoArea {
  nivel: NivelAcesso;
  extras: Permissao[];
}

export type MapaAcessos = Record<AreaAcessoId, AcessoArea>;

/**
 * Lê as permissões gravadas como níveis por área.
 *
 * O nível é o maior cujas permissões a pessoa tem **todas**. Uma combinação
 * antiga que não forma nível nenhum (editar sem ver, por exemplo) cai para o
 * nível completo abaixo — e, ao salvar de novo, fica coerente.
 */
export function acessosDasPermissoes(permissoes: readonly Permissao[]): MapaAcessos {
  const tem = new Set(permissoes);

  return Object.fromEntries(
    AREAS_ACESSO.map((area) => {
      const alcancados = area.niveis.filter((nivel) => nivel.permissoes.every((p) => tem.has(p)));
      const nivel = alcancados.at(-1)?.nivel ?? 'nenhum';
      const extrasValem = area.niveis.length === 0 || nivel !== 'nenhum';
      const extras = extrasValem
        ? area.extras.filter((extra) => tem.has(extra.codigo)).map((extra) => extra.codigo)
        : [];

      return [area.id, { nivel, extras }];
    }),
  ) as MapaAcessos;
}

/**
 * Converte a escolha por área em permissões — o que a API grava e o JWT leva.
 *
 * Extras de uma área sem nível são ignorados: "importar clientes" sem poder
 * ver clientes não é uma permissão que faça sentido conceder.
 */
export function permissoesDosAcessos(mapa: Partial<MapaAcessos>): Permissao[] {
  const resultado = new Set<Permissao>();

  for (const area of AREAS_ACESSO) {
    const acesso = mapa[area.id];
    if (!acesso) continue;

    const nivel = area.niveis.find((item) => item.nivel === acesso.nivel);
    nivel?.permissoes.forEach((p) => resultado.add(p));

    const extrasValem = area.niveis.length === 0 || nivel !== undefined;
    if (!extrasValem) continue;

    const permitidos = new Set(area.extras.map((extra) => extra.codigo));
    acesso.extras.filter((p) => permitidos.has(p)).forEach((p) => resultado.add(p));
  }

  return [...resultado];
}

export const acessoAreaSchema = z.object({
  nivel: z.enum(NIVEIS_ACESSO),
  extras: z.array(z.enum(PERMISSOES)).max(10),
});

/** A escolha por área que a tela envia. Áreas ausentes ficam sem acesso. */
export const mapaAcessosSchema = z.partialRecord(z.enum(AREAS_ACESSO_IDS), acessoAreaSchema);

export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  atendente: 'Atendente',
  tecnico: 'Técnico',
};

/** Para que serve cada papel — o ponto de partida antes de personalizar. */
export const DESCRICAO_PAPEL: Record<PapelUsuario, string> = {
  admin: 'Acesso total, inclusive equipe, plano e cobrança.',
  financeiro: 'Caixa, lançamentos, margem e previsão.',
  atendente: 'Clientes, funil, orçamentos e agenda.',
  tecnico: 'Agenda e execução dos serviços.',
};

/** O que a tela de equipe precisa para montar o editor de acesso. */
export interface CatalogoAcessos {
  areas: readonly AreaDeAcesso[];
  papeis: Array<{ papel: PapelUsuario; rotulo: string; descricao: string }>;
  /** O acesso de partida de cada papel, já em níveis. */
  padraoPorPapel: Record<PapelUsuario, MapaAcessos>;
}

export function montarCatalogoAcessos(): CatalogoAcessos {
  return {
    areas: AREAS_ACESSO,
    papeis: PAPEIS_USUARIO.map((papel) => ({
      papel,
      rotulo: ROTULO_PAPEL[papel],
      descricao: DESCRICAO_PAPEL[papel],
    })),
    padraoPorPapel: Object.fromEntries(
      PAPEIS_USUARIO.map((papel) => [
        papel,
        acessosDasPermissoes(PERMISSOES_PADRAO_POR_PAPEL[papel]),
      ]),
    ) as Record<PapelUsuario, MapaAcessos>,
  };
}
