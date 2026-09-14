import { AssistenteDemonstracao } from './assistente-demonstracao';
import { negocioDeTeste } from './fixtures-previsao';

const SEM_NEGOCIO = negocioDeTeste();

describe('AssistenteDemonstracao', () => {
  const assistente = new AssistenteDemonstracao();

  it('não classifica caixa zerado e sem projeções como risco baixo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '0.00',
      historico: [],
      projecoes: [],
      negocio: SEM_NEGOCIO,
    });
    expect(resultado.analise.nivelRisco).toBe('moderado');
    expect(resultado.analise.resumo).toContain('Ainda não há projeções');
    expect(resultado.analise.pontosAtencao.join(' ')).toContain('Histórico curto');
  });

  it('alerta sobre consumo de caixa mesmo com saldo acumulado positivo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '5000.00',
      historico: [],
      negocio: SEM_NEGOCIO,
      projecoes: [
        {
          mes: '2026-10',
          entradas: '100.00',
          saidas: '300.00',
          saldo: '-200.00',
          saldoAcumulado: '4800.00',
          contasAReceberConhecidas: '100.00',
          contasAPagarConhecidas: '300.00',
          receitaProvavelFunil: '0.00',
          compromissosRecorrentes: '0.00',
        },
      ],
    });
    expect(resultado.analise.nivelRisco).toBe('moderado');
    expect(resultado.analise.resumo).toContain('consumindo o caixa');
    expect(resultado.analise.acoesRecomendadas.join(' ')).toContain('categorias');
  });

  it('indica risco alto quando a projeção entra no negativo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '100.00',
      historico: [],
      negocio: SEM_NEGOCIO,
      projecoes: [
        {
          mes: '2026-10',
          entradas: '100.00',
          saidas: '300.00',
          saldo: '-200.00',
          saldoAcumulado: '-100.00',
          contasAReceberConhecidas: '0.00',
          contasAPagarConhecidas: '300.00',
          receitaProvavelFunil: '0.00',
          compromissosRecorrentes: '0.00',
        },
      ],
    });

    expect(resultado.modo).toBe('demonstracao');
    expect(resultado.analise.nivelRisco).toBe('alto');
    expect(resultado.inputTokens).toBe(0);
  });

  it('não promete resultado quando o caixa permanece positivo', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '1000.00',
      historico: [],
      negocio: SEM_NEGOCIO,
      projecoes: [
        {
          mes: '2026-10',
          entradas: '500.00',
          saidas: '200.00',
          saldo: '300.00',
          saldoAcumulado: '1300.00',
          contasAReceberConhecidas: '500.00',
          contasAPagarConhecidas: '200.00',
          receitaProvavelFunil: '0.00',
          compromissosRecorrentes: '0.00',
        },
      ],
    });

    expect(resultado.analise.nivelRisco).toBe('baixo');
    expect(resultado.analise.avisos.join(' ')).toMatch(/estimativa/i);
  });

  it('traz as contas vencidas como ponto de atenção da previsão', async () => {
    const resultado = await assistente.analisarPrevisao({
      identificadorSeguro: 'teste',
      saldoAtual: '1000.00',
      historico: [],
      projecoes: [],
      negocio: negocioDeTeste({ contasVencidas: { quantidade: 3, valor: '2500.00' } }),
    });

    expect(resultado.analise.pontosAtencao.join(' ')).toContain('3 conta(s) vencida(s)');
  });

  it('assume a conversa quando o modelo não responde, sem fingir análise', async () => {
    const resposta = await assistente.conversar({
      identificadorSeguro: 'teste',
      pergunta: 'como está meu caixa?',
      historico: [],
      papel: 'admin',
      panorama: {
        empresa: 'Empresa Teste',
        hoje: '2026-09-14',
        financeiro: {
          entradasMes: '5000.00',
          saidasMes: '3000.00',
          saldoMes: '2000.00',
          aReceber: '1200.00',
          aPagar: '800.00',
          vencidoAPagar: '0.00',
          vencidoAReceber: '0.00',
          ultimosMeses: [],
        },
      },
    });

    expect(resposta.modo).toBe('demonstracao');
    expect(resposta.texto).toContain('não respondeu');
    // Sem o "R$" na comparação: `formatarBRL` separa símbolo e número com
    // espaço não separável, que não é o espaço que se digita num teste.
    expect(resposta.texto).toMatch(/2\.000,00/);
  });
});
