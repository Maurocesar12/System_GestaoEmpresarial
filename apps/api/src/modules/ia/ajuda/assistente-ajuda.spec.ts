import { AssistenteAjuda, normalizar } from './assistente-ajuda';
import { BASE_DE_CONHECIMENTO } from './base-conhecimento';

describe('AssistenteAjuda', () => {
  const assistente = new AssistenteAjuda();

  it('responde sobre a tela certa mesmo sem acento e com erro de digitação', () => {
    const resultado = assistente.responder('como faco um orcamento?');

    expect(resultado.topico?.id).toBe('orcamentos');
    expect(resultado.referencias[0]?.href).toBe('/painel/orcamentos');
  });

  it('encontra a lista de reativação pelo problema, não pelo nome da tela', () => {
    expect(assistente.responder('tenho cliente que sumiu, como recupero?').topico?.id).toBe(
      'reativacao',
    );
  });

  it('separa a fila de leads da lista de reativação', () => {
    expect(assistente.responder('onde vejo os leads que chegaram hoje?').topico?.id).toBe('leads');
  });

  it('explica por que o saldo do mês não bate com o banco', () => {
    const resultado = assistente.responder('por que o saldo nao bate com o extrato do banco?');

    expect(resultado.topico?.id).toBe('financeiro-fluxo');
    expect(resultado.resposta).toContain('não é o saldo do banco');
  });

  it('não confunde perguntas sobre financeiro com o tópico de IA', () => {
    // "ia" é termo do tópico de IA e aparece dentro de "financeiro". Casamento
    // por palavra inteira é o que impede o desvio.
    expect(assistente.responder('como registro uma saida no financeiro?').topico?.id).toBe(
      'financeiro-lancamentos',
    );
  });

  it('admite quando não entende, em vez de responder qualquer coisa', () => {
    const resultado = assistente.responder('qual a capital da Mongólia?');

    expect(resultado.topico).toBeNull();
    expect(resultado.resposta).toContain('Não consegui identificar');
  });

  it('cumprimenta sem cair no "não entendi"', () => {
    expect(assistente.responder('oi').resposta).toContain('assistente de ajuda');
  });

  it('usa a pergunta anterior para resolver a pergunta curta seguinte', () => {
    const resultado = assistente.responder('e como eu configuro as etapas?', [
      { autor: 'usuario', texto: 'como funciona o funil de vendas?' },
      { autor: 'assistente', texto: 'O funil organiza as negociações por etapa.' },
    ]);

    expect(resultado.topico?.id).toBe('funil-etapas');
  });

  it('sugere assuntos que o próprio assistente sabe responder', () => {
    const resultado = assistente.responder('como cadastro um cliente?');

    for (const sugestao of resultado.sugestoes) {
      expect(assistente.responder(sugestao).topico).not.toBeNull();
    }
  });

  it('avisa que não consulta os dados da empresa quando perguntam o que ele faz', () => {
    const resultado = assistente.responder('o que voce faz?');

    expect(resultado.resposta).toContain('Não consulto os dados da sua empresa');
  });
});

describe('BASE_DE_CONHECIMENTO', () => {
  it('não tem ids repetidos', () => {
    const ids = BASE_DE_CONHECIMENTO.map((topico) => topico.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('só aponta para tópicos que existem', () => {
    const ids = new Set(BASE_DE_CONHECIMENTO.map((topico) => topico.id));

    for (const topico of BASE_DE_CONHECIMENTO) {
      for (const relacionado of topico.relacionados ?? []) {
        expect(ids.has(relacionado)).toBe(true);
      }
    }
  });

  it('guarda os termos já normalizados, senão eles nunca casariam', () => {
    for (const topico of BASE_DE_CONHECIMENTO) {
      for (const termo of topico.termos) {
        expect(termo).toBe(normalizar(termo));
      }
    }
  });

  it('aponta sempre para uma tela do painel', () => {
    for (const topico of BASE_DE_CONHECIMENTO) {
      expect(topico.href.startsWith('/painel')).toBe(true);
    }
  });
});
