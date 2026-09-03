export interface RegistroAuditoria {
  id: string;
  usuarioId: string | null;
  usuarioNome: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  antes: unknown;
  depois: unknown;
  criadoEm: string;
}
