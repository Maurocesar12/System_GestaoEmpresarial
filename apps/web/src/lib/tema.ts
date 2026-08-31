/**
 * Preferência de aparência.
 *
 * Fica separado do componente do alternador de propósito: o layout raiz é
 * componente de servidor e só precisa do script abaixo. Se ele importasse do
 * arquivo marcado com `'use client'`, arrastaria o componente inteiro — e o
 * React — para dentro de uma parte da aplicação que hoje não envia JavaScript
 * nenhum ao navegador.
 */

export const CHAVE_TEMA = 'gestao:tema';

export const TEMAS = ['claro', 'escuro', 'sistema'] as const;
export type Tema = (typeof TEMAS)[number];

/**
 * Script que roda antes da primeira pintura.
 *
 * Sem isto existe o "flash branco": a página aparece no tema claro e escurece
 * um instante depois, quando o React assume. Precisa ser síncrono e inline, no
 * `<head>` — qualquer coisa assíncrona chega tarde demais.
 *
 * Está em string porque é o único jeito de garantir execução antes da
 * hidratação. O conteúdo é constante e não interpola nada vindo do usuário,
 * então não há caminho para injeção aqui.
 */
export const SCRIPT_TEMA = `
(function () {
  try {
    var escolha = localStorage.getItem('${CHAVE_TEMA}');
    var escuro =
      escolha === 'escuro' ||
      ((!escolha || escolha === 'sistema') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', escuro);
  } catch (e) {
    /* Navegador com armazenamento bloqueado: segue no tema claro. */
  }
})();
`;
