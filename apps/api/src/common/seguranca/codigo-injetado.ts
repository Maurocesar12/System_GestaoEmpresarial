/**
 * Recusa código dentro de dados: HTML, script, links `javascript:`, fórmula
 * de planilha e caracteres invisíveis de controle.
 *
 * A tela já não executa nada do que é digitado — o React mostra tudo como
 * texto. Esta trava existe porque o dado não fica só na tela: vai para
 * exportação em planilha, e-mail, relatório, integração futura. Guardar
 * `<script>` no cadastro de um cliente é deixar uma armadilha para o primeiro
 * sistema que não escapar o texto. Recusar na entrada fecha a porta para todos.
 *
 * Roda dentro do `ZodValidationPipe`, por onde passa todo corpo e toda query
 * da API — inclusive o formulário público de leads do site.
 */

/** Campos que nunca são mostrados: senha e token podem ter qualquer caractere. */
const CAMPOS_LIVRES = /senha|password|token|desafio/i;

/**
 * Anexo em `data:...;base64,`, só dos tipos aceitos como anexo. Um
 * `data:text/html;base64,...` não é anexo — é uma página inteira embrulhada.
 */
const ANEXO_BASE64 =
  /^data:(?:application\/pdf|image\/(?:png|jpeg|webp));base64,[A-Za-z0-9+/]*={0,2}$/;

/** Profundidade máxima percorrida: um corpo mais fundo que isso é ataque. */
const PROFUNDIDADE_MAXIMA = 32;

interface Regra {
  padrao: RegExp;
  motivo: string;
}

const REGRAS: Regra[] = [
  {
    // Uma tag de verdade: `<` colado no nome (como o navegador interpreta).
    // "valor < 10" e "Fulano <fulano@x.com>" não casam; "<b>" e "<img src=x>" sim.
    padrao: /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/i,
    motivo: 'marcação HTML',
  },
  {
    // As tags perigosas mesmo sem fechar, e comentários/diretivas (`<!--`, `<?php`).
    padrao:
      /<\/?(?:script|iframe|frame|frameset|object|embed|applet|svg|math|img|image|video|audio|source|style|link|meta|base|form|input|button|body|html|template|xml)\b|<[!?]/i,
    motivo: 'código HTML ou script',
  },
  {
    padrao: /\b(?:java|vb|live)script\s*:|\bdata\s*:\s*text\/html/i,
    motivo: 'link que executa código',
  },
  {
    // Começar com "=" faz Excel e Google Planilhas tratarem a célula como
    // fórmula ao exportar — o caminho clássico de "CSV injection".
    padrao: /^\s*=/,
    motivo: 'fórmula de planilha',
  },
  {
    // Controle invisível e inversão de direção do texto: usados para esconder
    // conteúdo e disfarçar extensões ("fatura\u202efdp.exe").
    // eslint-disable-next-line no-control-regex -- achar esses caracteres é o objetivo da regra
    padrao: /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/,
    motivo: 'caracteres invisíveis de controle',
  },
];

export interface CodigoEncontrado {
  /** Caminho do campo, no mesmo formato dos erros de validação (`clientes.3.nome`). */
  campo: string;
  mensagem: string;
}

function conferirTexto(texto: string): string | undefined {
  const regra = REGRAS.find(({ padrao }) => padrao.test(texto));
  return regra
    ? `Este campo não aceita ${regra.motivo}. Remova trechos como <script>, <b>, "javascript:" ou "=FÓRMULA()".`
    : undefined;
}

/** Percorre o corpo já validado e devolve cada campo com código dentro. */
export function procurarCodigo(
  valor: unknown,
  caminho: string[] = [],
  achados: CodigoEncontrado[] = [],
): CodigoEncontrado[] {
  const campo = caminho.join('.') || '_';

  if (caminho.length > PROFUNDIDADE_MAXIMA) {
    achados.push({ campo, mensagem: 'Estrutura aninhada demais.' });
    return achados;
  }

  if (typeof valor === 'string') {
    const chave = caminho.at(-1) ?? '';
    if (CAMPOS_LIVRES.test(chave) || ANEXO_BASE64.test(valor)) return achados;

    const mensagem = conferirTexto(valor);
    if (mensagem) achados.push({ campo, mensagem });
    return achados;
  }

  if (Array.isArray(valor)) {
    valor.forEach((item, indice) => procurarCodigo(item, [...caminho, String(indice)], achados));
    return achados;
  }

  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    for (const [chave, item] of Object.entries(valor)) {
      // A chave também é dado: campos personalizados usam o nome que a
      // empresa escolheu, e ele aparece na tela e na exportação.
      const mensagemChave = conferirTexto(chave);
      if (mensagemChave)
        achados.push({ campo: [...caminho, chave].join('.'), mensagem: mensagemChave });
      procurarCodigo(item, [...caminho, chave], achados);
    }
  }

  return achados;
}
