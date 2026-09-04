import { Logger } from '@nestjs/common';
import { AssistenteOpenAI } from './assistente-openai';

const CONTEXTO = {
  identificadorSeguro: 'hash-seguro',
  saldoAtual: '1000.00',
  historico: [],
  projecoes: [],
};

describe('AssistenteOpenAI', () => {
  afterEach(() => jest.restoreAllMocks());

  it('envia somente o resumo agregado e registra o consumo devolvido', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    resumo: 'Caixa estável.',
                    nivelRisco: 'baixo',
                    pontosAtencao: [],
                    acoesRecomendadas: ['Atualize as contas.'],
                    avisos: ['Estimativa gerencial.'],
                  }),
                },
              ],
            },
          ],
          usage: { input_tokens: 120, output_tokens: 40 },
        }),
    } as Response);

    const resultado = await new AssistenteOpenAI(
      'sk-chave-de-teste',
      'modelo-teste',
      'https://api.openai.com/v1',
    ).analisarPrevisao(CONTEXTO);

    expect(resultado.modo).toBe('openai');
    expect(resultado.inputTokens).toBe(120);
    const corpoEnviado = fetchMock.mock.calls[0]?.[1]?.body;
    if (typeof corpoEnviado !== 'string') throw new Error('O corpo deveria ser JSON em texto.');
    const requisicao = JSON.parse(corpoEnviado) as {
      store: boolean;
      safety_identifier: string;
      text: { format: { type: string; strict: boolean } };
    };
    expect(requisicao.store).toBe(false);
    expect(requisicao.safety_identifier).toBe('hash-seguro');
    expect(requisicao.text.format).toMatchObject({ type: 'json_schema', strict: true });
  });

  it('usa a análise local quando o provedor falha', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('rede indisponível'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const resultado = await new AssistenteOpenAI(
      'sk-chave-de-teste',
      'modelo-teste',
      'https://api.openai.com/v1',
    ).analisarPrevisao(CONTEXTO);

    expect(resultado.modo).toBe('demonstracao');
    expect(resultado.modelo).toBe('analise-local-v1');
  });
});
