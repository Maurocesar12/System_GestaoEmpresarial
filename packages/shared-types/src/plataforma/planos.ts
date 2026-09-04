export interface PlanoAtualResponse {
  plano: {
    slug: string;
    nome: string;
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
  };
  integracaoIa: {
    conectada: boolean;
    modo: 'openai' | 'demonstracao';
  };
}
