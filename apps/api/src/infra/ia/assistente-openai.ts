import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { AssistenteDemonstracao } from './assistente-demonstracao';
import {
  AssistenteIa,
  type ContextoConversa,
  type ContextoPrevisao,
  type RespostaConversa,
  type ResultadoAssistenteIa,
} from './assistente-ia';

interface RespostaOpenAI {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const analiseSchema = z.object({
  resumo: z.string().max(1_500),
  nivelRisco: z.enum(['baixo', 'moderado', 'alto']),
  pontosAtencao: z.array(z.string().max(500)).max(5),
  acoesRecomendadas: z.array(z.string().max(500)).max(5),
  avisos: z.array(z.string().max(500)).max(5),
  // Opcionais na leitura, obrigatórios no formato pedido ao modelo. A
  // assimetria é proposital: exigir na ida é o que garante a resposta completa;
  // aceitar a ausência na volta evita descartar uma análise boa — e cair na
  // contingência — só porque o modelo suprimiu um campo.
  cenarios: z
    .object({
      pessimista: z.string().max(600),
      base: z.string().max(600),
      otimista: z.string().max(600),
    })
    .optional(),
  oportunidades: z.array(z.string().max(500)).max(5).optional(),
});

const FORMATO = {
  type: 'json_schema',
  name: 'analise_previsao_financeira',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      resumo: { type: 'string', maxLength: 1500 },
      nivelRisco: { type: 'string', enum: ['baixo', 'moderado', 'alto'] },
      pontosAtencao: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 500 } },
      acoesRecomendadas: {
        type: 'array',
        maxItems: 5,
        items: { type: 'string', maxLength: 500 },
      },
      avisos: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 500 } },
      cenarios: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pessimista: { type: 'string', maxLength: 600 },
          base: { type: 'string', maxLength: 600 },
          otimista: { type: 'string', maxLength: 600 },
        },
        required: ['pessimista', 'base', 'otimista'],
      },
      oportunidades: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 500 } },
    },
    required: [
      'resumo',
      'nivelRisco',
      'pontosAtencao',
      'acoesRecomendadas',
      'avisos',
      'cenarios',
      'oportunidades',
    ],
  },
} as const;

const respostaChatSchema = z.object({
  resposta: z.string().max(2_000),
  sugestoes: z.array(z.string().max(80)).max(3),
});

const FORMATO_CHAT = {
  type: 'json_schema',
  name: 'resposta_assistente',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      resposta: { type: 'string', maxLength: 2000 },
      sugestoes: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 80 } },
    },
    required: ['resposta', 'sugestoes'],
  },
} as const;

/**
 * Instruções da análise de previsão.
 *
 * O tom é de analista cuidadoso, não de consultor entusiasmado: quem lê vai
 * decidir preço e compromisso a partir disso. As proibições são explícitas
 * porque são exatamente os erros que um modelo comete sozinho — inventar
 * número, prometer resultado e opinar sobre tributação.
 */
const INSTRUCOES_PREVISAO =
  'Você é um analista financeiro gerencial cuidadoso de uma pequena empresa de serviços brasileira. ' +
  'Escreva em português do Brasil, direto e sem jargão. ' +
  'Use SOMENTE os números fornecidos: nunca invente valores, datas ou clientes, e nunca recalcule totais. ' +
  'Considere o negócio inteiro, não só o extrato: propostas em aberto ponderadas pela taxa de conversão informada, ' +
  'agendamentos futuros, compromissos recorrentes e contas vencidas. ' +
  'Deixe claro quando algo é dinheiro combinado e quando é dinheiro possível. ' +
  'Não prometa resultado, não dê conselho tributário e não substitua contador. ' +
  'Recomendações devem ser curtas, específicas e possíveis de executar nesta semana.';

/**
 * Instruções do chat.
 *
 * O maior risco aqui não é errar a conta — é responder sobre o que a pessoa não
 * pode ver. O panorama já chega filtrado por permissão, e a instrução fecha o
 * cerco: o que não está no panorama não existe para esta conversa.
 */
const INSTRUCOES_CHAT =
  'Você é o assistente de gestão de uma pequena empresa de serviços brasileira, dentro do próprio sistema que ela usa. ' +
  'Responda em português do Brasil, em no máximo três parágrafos curtos, com números quando eles existirem. ' +
  'Use EXCLUSIVAMENTE os dados do panorama fornecido. ' +
  'Se a resposta depender de algo que não está no panorama, diga que aquele dado não está disponível para o usuário e sugira a tela onde ele fica. ' +
  'Nunca invente valores, nomes de clientes ou datas. Nunca afirme ter feito alterações: você só lê. ' +
  'Saldo do mês não é saldo bancário nem lucro; proposta aberta não é receita garantida. ' +
  'Quando a pergunta for sobre como usar o sistema, explique o caminho da tela em vez de citar números. ' +
  'Termine sugerindo até três próximas perguntas úteis, curtas, na voz do usuário.';

export class AssistenteOpenAI extends AssistenteIa {
  private readonly logger = new Logger(AssistenteOpenAI.name);
  private readonly contingencia = new AssistenteDemonstracao();

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {
    super();
  }

  async analisarPrevisao(contexto: ContextoPrevisao): Promise<ResultadoAssistenteIa> {
    try {
      const corpo = await this.chamar({
        instrucoes: INSTRUCOES_PREVISAO,
        identificadorSeguro: contexto.identificadorSeguro,
        maxTokens: 1_400,
        formato: FORMATO,
        entrada: JSON.stringify({
          saldoAtual: contexto.saldoAtual,
          historicoRealizado: contexto.historico,
          projecaoCalculada: contexto.projecoes,
          panoramaDoNegocio: contexto.negocio,
        }),
      });

      return {
        modo: 'openai',
        modelo: this.model,
        analise: analiseSchema.parse(JSON.parse(this.textoDe(corpo))),
        inputTokens: corpo.usage?.input_tokens ?? 0,
        outputTokens: corpo.usage?.output_tokens ?? 0,
      };
    } catch (erro) {
      this.registrarFalha('previsão', erro);
      return this.contingencia.analisarPrevisao(contexto);
    }
  }

  async conversar(contexto: ContextoConversa): Promise<RespostaConversa> {
    try {
      const corpo = await this.chamar({
        instrucoes: INSTRUCOES_CHAT,
        identificadorSeguro: contexto.identificadorSeguro,
        maxTokens: 700,
        formato: FORMATO_CHAT,
        entrada: JSON.stringify({
          panorama: contexto.panorama,
          papelDoUsuario: contexto.papel,
          conversaAnterior: contexto.historico,
          pergunta: contexto.pergunta,
        }),
      });

      const resposta = respostaChatSchema.parse(JSON.parse(this.textoDe(corpo)));

      return {
        modo: 'openai',
        modelo: this.model,
        texto: resposta.resposta,
        sugestoes: resposta.sugestoes,
        inputTokens: corpo.usage?.input_tokens ?? 0,
        outputTokens: corpo.usage?.output_tokens ?? 0,
      };
    } catch (erro) {
      this.registrarFalha('chat', erro);
      return this.contingencia.conversar(contexto);
    }
  }

  /**
   * A chamada em si.
   *
   * `store: false` porque os dados são de uma empresa cliente e não têm por que
   * ficar guardados do lado do fornecedor. O `safety_identifier` é um hash, e
   * não o id do tenant: identifica o par empresa/usuário de forma estável para
   * o controle de abuso sem exportar identificador interno nenhum.
   */
  private async chamar(opcoes: {
    instrucoes: string;
    identificadorSeguro: string;
    maxTokens: number;
    formato: unknown;
    entrada: string;
  }): Promise<RespostaOpenAI> {
    const resposta = await fetch(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: this.model,
        store: false,
        max_output_tokens: opcoes.maxTokens,
        safety_identifier: opcoes.identificadorSeguro,
        instructions: opcoes.instrucoes,
        input: opcoes.entrada,
        text: { format: opcoes.formato },
      }),
    });

    if (!resposta.ok) throw new Error(`OpenAI respondeu HTTP ${resposta.status}`);

    return (await resposta.json()) as RespostaOpenAI;
  }

  private textoDe(corpo: RespostaOpenAI): string {
    const texto = corpo.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === 'output_text')?.text;

    if (!texto) throw new Error('OpenAI não devolveu output_text');

    return texto;
  }

  private registrarFalha(operacao: string, erro: unknown): void {
    this.logger.error(
      `Falha ao consultar a OpenAI (${operacao}); usando a análise local nesta solicitação.`,
      erro instanceof Error ? erro.stack : undefined,
    );
  }
}
