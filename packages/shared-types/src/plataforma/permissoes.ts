import type { PapelUsuario } from '../enums';

/** Ações protegidas do produto. O valor é persistido e viaja no JWT. */
export const PERMISSOES = [
  'clientes.visualizar',
  'clientes.criar',
  'clientes.editar',
  'clientes.excluir',
  'clientes.importar',
  'clientes.dados_pessoais',
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
  'estoque.visualizar',
  'estoque.gerenciar',
  'financeiro.visualizar',
  'financeiro.criar',
  'financeiro.editar',
  'financeiro.excluir',
  'financeiro.importar',
  'financeiro.exportar',
  'ia.previsao_financeira',
  'ia.visualizar_consumo',
  'marketing.visualizar',
  'marketing.gerenciar',
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
    'estoque.visualizar',
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
    // Quem atende o lead é quem melhor aproveita saber de onde ele veio.
    // Gerar a chave do site fica com o administrador.
    'marketing.visualizar',
  ],
  tecnico: [
    ...CRM_LEITURA,
    'clientes.editar',
    'funil.movimentar',
    'agenda.gerenciar',
    'estoque.visualizar',
  ],
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
