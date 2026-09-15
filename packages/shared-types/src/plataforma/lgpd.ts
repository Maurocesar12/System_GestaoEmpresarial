import { z } from 'zod';

/**
 * Contrato da LGPD (arquitetura §9.4).
 *
 * Os prazos ficam aqui porque três lugares precisam do mesmo número: a API, que
 * apaga; a política publicada no site, que promete; e a tela de cancelamento,
 * que avisa. Se divergirem, o site promete uma coisa e o sistema faz outra.
 */

/** Dias entre o cancelamento da conta e a exclusão definitiva dos dados. */
export const DIAS_PARA_EXCLUIR_CONTA_CANCELADA = 30;

/** Validade do refresh token, espelhando `JWT_REFRESH_TTL_DIAS` do `.env.example`. */
export const DIAS_VALIDADE_SESSAO = 7;

export const NOME_CLIENTE_ANONIMIZADO = 'Cliente anonimizado';
export const TEXTO_REMOVIDO_LGPD = '[removido a pedido do titular]';

const DIA_MS = 24 * 60 * 60 * 1000;

export function calcularExclusaoPrevista(canceladoEm: Date): Date {
  return new Date(canceladoEm.getTime() + DIAS_PARA_EXCLUIR_CONTA_CANCELADA * DIA_MS);
}

export const cancelamentoContaSchema = z.object({
  nomeEmpresa: z.string().trim().min(1, 'Digite o nome da empresa para confirmar').max(120),
  senha: z.string().min(1, 'Informe sua senha').max(128),
});
export type CancelamentoContaInput = z.infer<typeof cancelamentoContaSchema>;

export interface ContaCancelada {
  canceladoEm: string;
  /** `AAAA-MM-DD`. */
  exclusaoPrevistaEm: string;
}

/** Tudo que o sistema guarda sobre um cliente, para entregar ao titular (art. 18, II e V). */
export interface DadosDoTitular {
  geradoEm: string;
  empresa: string;
  cliente: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    documento: string | null;
    observacoes: string | null;
    origem: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    etapaFunil: string | null;
    etiquetas: string[];
    camposPersonalizados: Array<{ campo: string; valor: string }>;
    criadoEm: string;
    atualizadoEm: string;
  };
  atendimentos: Array<{ data: string; descricao: string }>;
  orcamentos: Array<{
    servico: string | null;
    descricao: string | null;
    valor: string;
    status: string;
    validoAte: string | null;
    criadoEm: string;
  }>;
  agendamentos: Array<{
    servico: string | null;
    dataHora: string;
    status: string;
    observacoes: string | null;
  }>;
  lembretes: Array<{ canal: string; status: string; dataEnvio: string; enviadoEm: string | null }>;
  lancamentos: Array<{
    tipo: string;
    descricao: string;
    valor: string;
    data: string;
    pagoEm: string | null;
  }>;
}

/**
 * Cópia dos dados da empresa, para ela levar antes de cancelar.
 *
 * As tabelas vão como vieram do banco, sem remapear campo a campo: é um arquivo
 * de portabilidade, e cada tradução seria um lugar a mais para esquecer uma
 * coluna nova. Hash de senha e conteúdo de anexos ficam de fora.
 */
export interface ExportacaoEmpresa {
  geradoEm: string;
  versao: 1;
  empresa: Record<string, unknown>;
  tabelas: Record<string, unknown[]>;
}
