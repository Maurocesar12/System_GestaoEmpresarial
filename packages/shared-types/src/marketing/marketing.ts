import { z } from 'zod';
import { opcional, textoOpcional } from '../common/opcional';
import { telefoneSchema } from '../crm/clientes';

/**
 * Marketing — módulo beta (arquitetura §8.3).
 *
 * Escopo deliberadamente mínimo: de onde os leads vêm, quanto cada origem
 * converte, e um formulário para colar no site. Fora do beta ficam e-mail
 * marketing, campanhas de WhatsApp e construtor de landing page.
 *
 * Marcado como Beta na interface e fora dos planos pagos, o que preserva a
 * liberdade de mudar ou remover sem quebrar promessa comercial.
 */

// --- Relatórios ------------------------------------------------------------

/** Uma origem e o que ela produziu. */
export interface DesempenhoDaOrigem {
  /** `null` é o balde de quem entrou sem origem preenchida. */
  origem: string | null;
  leads: number;
  /** Leads que já têm orçamento aprovado. */
  convertidos: number;
  /** `convertidos / leads`, de 0 a 1. */
  taxaConversao: number;
  /** Soma dos orçamentos aprovados desses clientes. */
  receita: string;
}

/** Quantos clientes estão em cada etapa do funil, hoje. */
export interface OcupacaoDaEtapa {
  etapaId: string;
  etapa: string;
  ordem: number;
  clientes: number;
}

export interface RelatorioMarketing {
  origens: DesempenhoDaOrigem[];
  etapas: OcupacaoDaEtapa[];
  totalLeads: number;
  periodo: { de: string; ate: string };
}

export const marketingQuerySchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida'),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida'),
});

export type MarketingQuery = z.infer<typeof marketingQuerySchema>;

// --- Formulário embedável --------------------------------------------------

/** O que a tela mostra para o assinante copiar. */
export interface ChaveMarketing {
  /** `null` enquanto ninguém gerou — o formulário é opcional. */
  chave: string | null;
}

/**
 * Nome do campo-armadilha do formulário.
 *
 * Fica escondido por CSS, então uma pessoa nunca o preenche. Robô que preenche
 * tudo que encontra entrega-se sozinho, e o envio é descartado **sem erro**:
 * responder "recebido" evita que quem automatiza descubra a regra e a contorne.
 */
export const CAMPO_ARMADILHA = 'sobrenome_confirmacao';

/**
 * O que o formulário público envia.
 *
 * Só o nome é obrigatório, como no cadastro normal: um formulário de captação
 * que exige muito não é preenchido. O consentimento é a exceção — sem base
 * legal registrada, não há por que guardar o dado (LGPD, arquitetura §9.4).
 */
export const leadPublicoSchema = z.object({
  chave: z.string().trim().min(10).max(120),
  nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: opcional(z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'))),
  // O mesmo schema do cadastro normal, que descarta a máscara e guarda só os
  // dígitos. Um telefone gravado como "(11) 91234-5678" aqui e como
  // "11912345678" ali nunca seria reconhecido como o mesmo contato — e é
  // justamente por telefone que o servidor evita cadastrar o lead duas vezes.
  telefone: opcional(telefoneSchema),
  mensagem: textoOpcional(1000),

  origem: textoOpcional(60),
  utmSource: opcional(z.string().trim().max(120)),
  utmMedium: opcional(z.string().trim().max(120)),
  utmCampaign: opcional(z.string().trim().max(120)),

  /** Aviso de coleta aceito. Sem isto, o envio é recusado. */
  consentimento: z.literal(true, { error: 'É preciso aceitar o aviso de privacidade.' }),

  /** O campo-armadilha. Preenchido significa robô. */
  [CAMPO_ARMADILHA]: z.string().max(200).optional(),
});

export type LeadPublicoInput = z.infer<typeof leadPublicoSchema>;

/**
 * A resposta do endpoint público.
 *
 * Não devolve id, nem nome da empresa, nem nada que confirme o que existe do
 * outro lado: é um endpoint aberto, e cada campo a mais na resposta é um
 * campo a mais para alguém sondar.
 */
export interface LeadPublicoResposta {
  recebido: true;
}

/** Origem gravada quando o lead chega pelo formulário e não traz outra. */
export const ORIGEM_FORMULARIO = 'Formulário do site';
