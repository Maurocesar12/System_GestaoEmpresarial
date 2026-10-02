'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Prévia calculada pela API enquanto a pessoa digita.
 *
 * Parcelas, margem, custo de materiais, projeção de reserva: a tela não faz
 * conta nenhuma. Ela manda o que foi digitado para uma rota `simular` — que
 * usa as mesmas funções da gravação — e mostra o que voltar. Assim a prévia
 * nunca promete um número que o servidor gravaria diferente.
 *
 * Espera a digitação parar (`atrasoMs`) para não disparar uma chamada por
 * tecla, e descarta a resposta atrasada de uma entrada que já mudou.
 *
 * @param entrada O que simular, ou `null` quando ainda não há o que mostrar.
 * @param simular A server action. Uma entrada que a API recusa vira `null`:
 *   prévia some, e o erro de verdade aparece ao salvar.
 */
export function useSimulacao<Entrada, Resultado>(
  entrada: Entrada | null,
  simular: (entrada: Entrada) => Promise<{ dados?: Resultado }>,
  atrasoMs = 300,
): Resultado | null {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const versao = useRef(0);

  // A chave em texto faz o efeito rodar só quando o conteúdo muda, e não a
  // cada objeto novo que a renderização cria com os mesmos valores.
  const chave = entrada === null ? null : JSON.stringify(entrada);

  useEffect(() => {
    const atual = ++versao.current;

    const temporizador = setTimeout(
      () => {
        if (chave === null) {
          setResultado(null);
          return;
        }

        void simular(JSON.parse(chave) as Entrada).then((resposta) => {
          if (atual === versao.current) setResultado(resposta.dados ?? null);
        });
      },
      chave === null ? 0 : atrasoMs,
    );

    return () => clearTimeout(temporizador);
  }, [chave, simular, atrasoMs]);

  return resultado;
}
