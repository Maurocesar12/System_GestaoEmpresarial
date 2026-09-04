import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { AssistenteDemonstracao } from './assistente-demonstracao';
import { AssistenteIa, type ContextoPrevisao, type ResultadoAssistenteIa } from './assistente-ia';

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
    },
    required: ['resumo', 'nivelRisco', 'pontosAtencao', 'acoesRecomendadas', 'avisos'],
  },
} as const;

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
      const resposta = await fetch(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model: this.model,
          store: false,
          max_output_tokens: 900,
          safety_identifier: contexto.identificadorSeguro,
          instructions:
            'Você é um analista financeiro gerencial cuidadoso. Explique em português do Brasil, sem inventar números, sem prometer resultados e sem substituir contador. Use somente os totais fornecidos. Produza recomendações curtas e acionáveis.',
          input: JSON.stringify({
            saldoAtual: contexto.saldoAtual,
            historicoRealizado: contexto.historico,
            projecaoCalculada: contexto.projecoes,
          }),
          text: { format: FORMATO },
        }),
      });

      if (!resposta.ok) throw new Error(`OpenAI respondeu HTTP ${resposta.status}`);
      const corpo = (await resposta.json()) as RespostaOpenAI;
      const texto = corpo.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')?.text;
      if (!texto) throw new Error('OpenAI não devolveu output_text');

      return {
        modo: 'openai',
        modelo: this.model,
        analise: analiseSchema.parse(JSON.parse(texto)),
        inputTokens: corpo.usage?.input_tokens ?? 0,
        outputTokens: corpo.usage?.output_tokens ?? 0,
      };
    } catch (erro) {
      this.logger.error(
        'Falha ao consultar a OpenAI; usando análise local nesta solicitação.',
        erro instanceof Error ? erro.stack : undefined,
      );
      return this.contingencia.analisarPrevisao(contexto);
    }
  }
}
