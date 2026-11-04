import { Fragment } from 'react';
import { TERMOS, type ChaveTermo, type TextoComTermos } from './conteudo';

/**
 * Uma palavra de finanças com a explicação ao lado, num balão.
 *
 * Sem JavaScript: o balão aparece no hover e no foco (`:focus-within`), então
 * funciona com mouse, com teclado (Tab até a palavra) e no celular (o toque dá
 * foco ao botão). O texto do balão está sempre no HTML e ligado ao botão por
 * `aria-describedby`, então o leitor de tela o lê junto com a palavra.
 */
export function Termo({ chave }: { chave: ChaveTermo }) {
  const { rotulo, explicacao } = TERMOS[chave];
  const id = `termo-${chave}`;

  return (
    <span className="termo">
      <button type="button" aria-describedby={id}>
        {rotulo}
      </button>
      <span role="tooltip" id={id}>
        {explicacao}
      </span>
    </span>
  );
}

/** Texto do `conteudo.ts` com termos explicados no meio. */
export function TextoComTermo({ partes }: { partes: TextoComTermos }) {
  return (
    <>
      {partes.map((parte, indice) => (
        <Fragment key={indice}>
          {typeof parte === 'string' ? parte : <Termo chave={parte.termo} />}
        </Fragment>
      ))}
    </>
  );
}
