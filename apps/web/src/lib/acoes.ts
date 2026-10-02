import { CODIGOS_ERRO } from '@gestao/shared-types';
import { ApiRequestError } from './api';

/**
 * O que uma server action devolve à tela.
 *
 * Quem valida é só a API. As server actions não conferem nada: repassam os
 * dados como foram digitados, e a API devolve os erros agrupados por campo em
 * `detalhes` — que chegam aqui em `campos`, prontos para a tela marcar cada
 * input. Uma regra, um lugar: a tela nunca aprova o que a API recusaria, nem
 * recusa o que ela aceitaria.
 */
export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

export function traduzirErroAcao(
  erro: unknown,
  mensagemPadrao = 'Não foi possível completar a ação. Tente novamente.',
): ResultadoAcao {
  if (!(erro instanceof ApiRequestError)) {
    return { erro: mensagemPadrao };
  }

  const { codigo, mensagem, detalhes } = erro.erro;

  if (codigo === CODIGOS_ERRO.VALIDACAO && detalhes) {
    const mensagens = Object.values(detalhes).flat();

    // Um erro só (o botão "Confirmar" de uma ação, um campo único) vira a
    // própria mensagem. Vários viram o aviso geral, e cada campo mostra o seu.
    return {
      erro: mensagens.length === 1 ? mensagens[0] : 'Confira os campos destacados.',
      campos: detalhes,
    };
  }

  return { erro: mensagem, campos: detalhes };
}
