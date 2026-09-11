import type { PapelUsuario } from '../enums';

/** Ações protegidas do produto. O valor é persistido e viaja no JWT. */
export const PERMISSOES = [
  'clientes.visualizar',
  'clientes.criar',
  'clientes.editar',
  'clientes.excluir',
  'clientes.importar',
  'funil.visualizar',
  'funil.movimentar',
  'funil.configurar',
  'orcamentos.visualizar',
  'orcamentos.gerenciar',
  'agenda.visualizar',
  'agenda.gerenciar',
  'lembretes.visualizar',
  'lembretes.gerenciar',
  'servicos.visualizar',
  'servicos.gerenciar',
  'financeiro.visualizar',
  'financeiro.criar',
  'financeiro.editar',
  'financeiro.excluir',
  'financeiro.importar',
  'financeiro.exportar',
  'ia.previsao_financeira',
  'ia.visualizar_consumo',
  'equipe.gerenciar',
  'auditoria.visualizar',
  'empresa.configurar',
] as const;

export type Permissao = (typeof PERMISSOES)[number];

const CRM_LEITURA: Permissao[] = [
  'clientes.visualizar',
  'funil.visualizar',
  'orcamentos.visualizar',
  'agenda.visualizar',
  'lembretes.visualizar',
  'servicos.visualizar',
];

/** Conjuntos iniciais. O administrador pode personalizar cada funcionário. */
export const PERMISSOES_PADRAO_POR_PAPEL: Record<PapelUsuario, readonly Permissao[]> = {
  admin: PERMISSOES,
  financeiro: [
    'servicos.visualizar',
    'servicos.gerenciar',
    'financeiro.visualizar',
    'financeiro.criar',
    'financeiro.editar',
    'financeiro.excluir',
    'financeiro.importar',
    'financeiro.exportar',
    'ia.previsao_financeira',
    'ia.visualizar_consumo',
  ],
  atendente: [
    ...CRM_LEITURA,
    'clientes.criar',
    'clientes.editar',
    'funil.movimentar',
    'orcamentos.gerenciar',
    'agenda.gerenciar',
    'lembretes.gerenciar',
  ],
  tecnico: [...CRM_LEITURA, 'clientes.editar', 'funil.movimentar', 'agenda.gerenciar'],
};

export function permissoesDoUsuario(
  papel: PapelUsuario,
  personalizadas: readonly string[] | undefined,
): Permissao[] {
  const origem = personalizadas ?? PERMISSOES_PADRAO_POR_PAPEL[papel];
  const validas = new Set<string>(PERMISSOES);
  return [...new Set(origem.filter((item): item is Permissao => validas.has(item)))];
}

export function possuiPermissao(
  usuario: { papel: PapelUsuario; permissoes?: readonly Permissao[] },
  permissao: Permissao,
): boolean {
  return (usuario.permissoes ?? PERMISSOES_PADRAO_POR_PAPEL[usuario.papel]).includes(permissao);
}

export const GRUPOS_PERMISSOES: ReadonlyArray<{
  titulo: string;
  itens: ReadonlyArray<{ codigo: Permissao; rotulo: string }>;
}> = [
  {
    titulo: 'Clientes',
    itens: [
      { codigo: 'clientes.visualizar', rotulo: 'Visualizar clientes' },
      { codigo: 'clientes.criar', rotulo: 'Cadastrar clientes' },
      { codigo: 'clientes.editar', rotulo: 'Editar clientes' },
      { codigo: 'clientes.excluir', rotulo: 'Excluir clientes' },
      { codigo: 'clientes.importar', rotulo: 'Importar clientes' },
    ],
  },
  {
    titulo: 'Operação',
    itens: [
      { codigo: 'funil.visualizar', rotulo: 'Visualizar funil' },
      { codigo: 'funil.movimentar', rotulo: 'Movimentar clientes no funil' },
      { codigo: 'funil.configurar', rotulo: 'Configurar etapas do funil' },
      { codigo: 'orcamentos.visualizar', rotulo: 'Visualizar orçamentos' },
      { codigo: 'orcamentos.gerenciar', rotulo: 'Gerenciar orçamentos' },
      { codigo: 'agenda.visualizar', rotulo: 'Visualizar agenda' },
      { codigo: 'agenda.gerenciar', rotulo: 'Gerenciar agenda' },
      { codigo: 'lembretes.visualizar', rotulo: 'Visualizar lembretes' },
      { codigo: 'lembretes.gerenciar', rotulo: 'Gerenciar lembretes' },
      { codigo: 'servicos.visualizar', rotulo: 'Visualizar serviços' },
      { codigo: 'servicos.gerenciar', rotulo: 'Gerenciar serviços' },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { codigo: 'financeiro.visualizar', rotulo: 'Visualizar valores e relatórios' },
      { codigo: 'financeiro.criar', rotulo: 'Criar lançamentos' },
      { codigo: 'financeiro.editar', rotulo: 'Editar e dar baixa' },
      { codigo: 'financeiro.excluir', rotulo: 'Excluir lançamentos' },
      { codigo: 'financeiro.importar', rotulo: 'Importar lançamentos' },
      { codigo: 'financeiro.exportar', rotulo: 'Exportar lançamentos' },
    ],
  },
  {
    titulo: 'Inteligência artificial',
    itens: [
      { codigo: 'ia.previsao_financeira', rotulo: 'Gerar previsão financeira' },
      { codigo: 'ia.visualizar_consumo', rotulo: 'Visualizar consumo de IA' },
    ],
  },
  {
    titulo: 'Administração',
    itens: [
      { codigo: 'equipe.gerenciar', rotulo: 'Gerenciar equipe e convites' },
      { codigo: 'auditoria.visualizar', rotulo: 'Visualizar auditoria' },
      { codigo: 'empresa.configurar', rotulo: 'Configurar empresa e campos' },
    ],
  },
];
