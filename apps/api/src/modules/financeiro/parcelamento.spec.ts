import { dividirEmParcelas, ocorrenciaDoCiclo, somarDinheiro } from '@gestao/shared-types';

/**
 * A propriedade que importa: a soma das parcelas é o total, sempre.
 *
 * É o que faz a conciliação bancária fechar. Um centavo perdido aqui só
 * aparece meses depois, como uma diferença que ninguém sabe de onde veio.
 */
describe('divisão em parcelas', () => {
  it('divide valor exato em partes iguais', () => {
    expect(dividirEmParcelas('300.00', 3)).toEqual(['100.00', '100.00', '100.00']);
  });

  it('põe a sobra na última parcela', () => {
    expect(dividirEmParcelas('1000.00', 3)).toEqual(['333.33', '333.33', '333.34']);
  });

  it('devolve o próprio total quando é uma parcela só', () => {
    expect(dividirEmParcelas('49.90', 1)).toEqual(['49.90']);
  });

  it('acerta o caso de dois centavos de sobra', () => {
    expect(dividirEmParcelas('100.00', 6)).toEqual([
      '16.66',
      '16.66',
      '16.66',
      '16.66',
      '16.66',
      '16.70',
    ]);
  });

  it('lida com total que tem centavos quebrados', () => {
    expect(dividirEmParcelas('49.99', 2)).toEqual(['24.99', '25.00']);
  });

  // O laço cobre o que um exemplo isolado não cobre: qualquer combinação de
  // total e parcelas precisa somar de volta ao total.
  it('soma sempre de volta ao total, em qualquer divisão', () => {
    const totais = ['0.01', '0.03', '10.00', '49.99', '1000.00', '1234.56', '99999.99'];

    for (const total of totais) {
      for (let parcelas = 1; parcelas <= 24; parcelas++) {
        const partes = dividirEmParcelas(total, parcelas);

        expect(partes).toHaveLength(parcelas);
        expect(somarDinheiro(partes)).toBe(total);
      }
    }
  });

  it('não devolve parcela negativa mesmo quando o total é menor que o número de parcelas', () => {
    // R$ 0,01 em 3 vezes: duas parcelas de zero e uma de um centavo. Zero é
    // esquisito, mas é melhor que um centavo virar -0,00 em duas delas.
    const partes = dividirEmParcelas('0.01', 3);

    expect(partes).toEqual(['0.00', '0.00', '0.01']);
    expect(somarDinheiro(partes)).toBe('0.01');
  });
});

/**
 * O vencimento não pode escorregar de mês.
 *
 * Um aluguel que vence dia 31 tem de continuar no fim do mês depois de passar
 * por fevereiro. Somar mês a mês ingenuamente empurraria para 3 de março, e
 * daí para frente a data nunca mais voltaria ao lugar.
 */
describe('ocorrência do ciclo', () => {
  it('a ocorrência zero é o próprio início', () => {
    expect(ocorrenciaDoCiclo('2026-01-10', 'mensal', 0)).toBe('2026-01-10');
  });

  it('avança um mês por ocorrência', () => {
    expect(ocorrenciaDoCiclo('2026-01-10', 'mensal', 1)).toBe('2026-02-10');
    expect(ocorrenciaDoCiclo('2026-01-10', 'mensal', 2)).toBe('2026-03-10');
  });

  it('encurta para o último dia quando o mês de destino é mais curto', () => {
    expect(ocorrenciaDoCiclo('2026-01-31', 'mensal', 1)).toBe('2026-02-28');
  });

  /**
   * O caso que motivou o desenho inteiro.
   *
   * Derivando da data anterior, 31/01 → 28/02 → 28/03, e o aluguel do dia 31
   * migrava para o dia 28 para sempre. Ancorado no início, o encurtamento vale
   * só para fevereiro.
   */
  it('não deixa o encurtamento de fevereiro contaminar março', () => {
    expect(ocorrenciaDoCiclo('2026-01-31', 'mensal', 1)).toBe('2026-02-28');
    expect(ocorrenciaDoCiclo('2026-01-31', 'mensal', 2)).toBe('2026-03-31');
  });

  it('volta ao dia 31 depois de doze meses', () => {
    expect(ocorrenciaDoCiclo('2026-01-31', 'mensal', 12)).toBe('2027-01-31');
  });

  it('acerta fevereiro em ano bissexto', () => {
    expect(ocorrenciaDoCiclo('2028-01-31', 'mensal', 1)).toBe('2028-02-29');
  });

  it('atravessa a virada do ano', () => {
    expect(ocorrenciaDoCiclo('2026-12-15', 'mensal', 1)).toBe('2027-01-15');
  });

  it('avança sete dias por ocorrência na semanal, virando o mês', () => {
    expect(ocorrenciaDoCiclo('2026-01-28', 'semanal', 1)).toBe('2026-02-04');
    expect(ocorrenciaDoCiclo('2026-01-28', 'semanal', 5)).toBe('2026-03-04');
  });

  it('avança três meses por ocorrência na trimestral', () => {
    expect(ocorrenciaDoCiclo('2026-01-31', 'trimestral', 1)).toBe('2026-04-30');
    expect(ocorrenciaDoCiclo('2026-01-31', 'trimestral', 2)).toBe('2026-07-31');
  });

  it('avança um ano por ocorrência na anual', () => {
    expect(ocorrenciaDoCiclo('2026-03-05', 'anual', 1)).toBe('2027-03-05');
  });

  it('não perde o 29 de fevereiro ao avançar para um ano comum', () => {
    // 2029 não é bissexto: encurta para 28, e não escorrega para 1º de março.
    expect(ocorrenciaDoCiclo('2028-02-29', 'anual', 1)).toBe('2029-02-28');
    // E volta ao 29 no bissexto seguinte, porque a âncora não mudou.
    expect(ocorrenciaDoCiclo('2028-02-29', 'anual', 4)).toBe('2032-02-29');
  });

  // A data de uma ocorrência não pode depender de por onde o cálculo passou:
  // pedir a décima direto tem de dar o mesmo que qualquer caminho até ela.
  it('é estável — o dia do ciclo nunca deriva', () => {
    const dias = Array.from({ length: 36 }, (_, i) => ocorrenciaDoCiclo('2026-01-31', 'mensal', i));
    const diasDoMes = new Set(dias.map((dia) => dia.slice(8)));

    // Só dois valores possíveis: 31 nos meses longos, e o último dia nos curtos.
    expect([...diasDoMes].sort()).toEqual(['28', '29', '30', '31']);
  });
});
