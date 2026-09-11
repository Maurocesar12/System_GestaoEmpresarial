import type { SituacaoDeAcesso } from './acesso';

export type PlanoComercialSlug = 'essencial' | 'profissional';

export const HIERARQUIA_PLANOS: readonly PlanoComercialSlug[] = ['essencial', 'profissional'];

export interface PlanoCatalogo {
  slug: PlanoComercialSlug;
  nome: string;
  descricao: string;
  nivel: number;
  destaque: boolean;
  preco: string;
  usuariosInclusos: number | null;
  precoUsuarioAdicional: string;
  limiteUsuarios: number | null;
  limiteClientes: number | null;
  limiteEnviosMensais: number | null;
  iaHabilitada: boolean;
  limitePrevisoesIaMensais: number | null;
}

export interface PlanosCatalogoResponse {
  planos: PlanoCatalogo[];
  hierarquia: readonly PlanoComercialSlug[];
  totalAtivos: number;
}

export interface PlanoAtualResponse {
  plano: {
    slug: string;
    nome: string;
    descricao: string;
    nivel: number;
    destaque: boolean;
    preco: string;
    iaHabilitada: boolean;
  };
  cobranca: {
    precoBase: string;
    usuariosInclusos: number | null;
    usuariosAdicionais: number;
    precoPorUsuarioAdicional: string;
    adicionalUsuarios: string;
    mensalidadeEstimada: string;
  };
  limites: {
    usuarios: number | null;
    clientes: number | null;
    previsoesIaMensais: number | null;
  };
  uso: {
    usuarios: number;
    clientes: number;
    previsoesIaNoMes: number;
  };
  assinatura: {
    status: string;
    trialTerminaEm: string | null;
    /** Dia do último pagamento confirmado, `AAAA-MM-DD`. */
    ultimoPagamentoEm: string | null;
    /** Até quando o acesso está garantido, pela regra de um mês por pagamento. */
    acesso: SituacaoDeAcesso;
  };
  integracaoIa: {
    conectada: boolean;
    modo: 'openai' | 'demonstracao';
  };
}
