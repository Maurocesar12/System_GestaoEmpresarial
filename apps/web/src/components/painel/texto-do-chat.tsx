import { Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * O texto do assistente, com a marcação mínima interpretada.
 *
 * As respostas chegam com três coisas: `**negrito**`, marcadores `•` e
 * parágrafos separados por linha em branco. Sem interpretar isso, a pessoa lê
 * asteriscos crus no meio da frase — era o que acontecia.
 *
 * O bloco que começa com `**Dica:**` ganha destaque próprio. Quase toda
 * resposta da base de conhecimento termina com uma, e é justamente a parte
 * prática: separá-la do texto corrido é o que faz a pessoa enxergá-la em vez
 * de atravessá-la.
 *
 * ## Por que não uma biblioteca de Markdown
 *
 * Seriam dezenas de kilobytes para interpretar negrito e bullet. E, no plano
 * Premium, o texto vem de um modelo de linguagem: montar **elementos React**,
 * como aqui, é imune a injeção. Um `dangerouslySetInnerHTML` no mesmo lugar
 * seria uma porta aberta de XSS.
 */

const MARCADOR_DICA = '**Dica:**';

export function TextoDoChat({ texto }: { texto: string }) {
  const blocos = texto
    .split(/\n{2,}/)
    .map((bloco) => bloco.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2.5">
      {blocos.map((bloco, indice) => (
        <Bloco key={indice} texto={bloco} />
      ))}
    </div>
  );
}

function Bloco({ texto }: { texto: string }) {
  if (texto.startsWith(MARCADOR_DICA)) {
    return (
      <div className="bg-info-suave/60 border-info/25 flex gap-2 rounded-md border px-2.5 py-2">
        <Lightbulb aria-hidden className="text-info mt-0.5 size-3.5 shrink-0" />
        <p className="text-[0.8125rem] leading-relaxed">
          {/* O rótulo visual é o ícone; o leitor de tela precisa da palavra. */}
          <span className="sr-only">Dica: </span>
          {comNegrito(texto.slice(MARCADOR_DICA.length).trim())}
        </p>
      </div>
    );
  }

  const linhas = texto.split('\n').map((linha) => linha.trim());

  if (linhas.length > 1 && linhas.every((linha) => linha.startsWith('•'))) {
    return (
      <ul className="space-y-1.5">
        {linhas.map((linha, indice) => (
          <li key={indice} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground leading-relaxed">
              •
            </span>
            <span className="leading-relaxed">{comNegrito(linha.slice(1).trim())}</span>
          </li>
        ))}
      </ul>
    );
  }

  // `whitespace-pre-line` preserva quebras simples: um bloco misto — frase
  // seguida de bullets na mesma linha em branco — continua legível em vez de
  // virar um parágrafo emendado.
  return <p className="leading-relaxed whitespace-pre-line">{comNegrito(texto)}</p>;
}

/** Troca `**trecho**` por `<strong>`, deixando o resto como texto. */
function comNegrito(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, indice) =>
    parte.length > 4 && parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={indice} className="font-semibold">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      parte
    ),
  );
}
