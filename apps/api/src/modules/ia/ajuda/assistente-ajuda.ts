import { Injectable } from '@nestjs/common';
import type { MensagemChat, ReferenciaAjuda } from '@gestao/shared-types';
import {
  ASSUNTOS_PRINCIPAIS,
  BASE_DE_CONHECIMENTO,
  SUGESTOES_DE_AJUDA,
  type TopicoAjuda,
} from './base-conhecimento';

export interface RespostaDeAjuda {
  resposta: string;
  referencias: ReferenciaAjuda[];
  sugestoes: string[];
  /** O tópico que respondeu, ou `null` quando nada casou. */
  topico: TopicoAjuda | null;
}

/**
 * Pontuação mínima para considerar que a pergunta casou com um tópico.
 *
 * Abaixo disso é melhor admitir que não entendeu: uma resposta errada com cara
 * de certa custa mais caro que "não entendi, foi sobre qual assunto?" — a
 * pessoa segue o caminho errado achando que está no certo.
 *
 * O valor equivale a **uma palavra comum** casando sozinha: quem digita só
 * "clientes" recebe o tópico de clientes, quem pergunta a capital da Mongólia
 * não recebe nada.
 */
const PONTUACAO_MINIMA = 0.4;

/**
 * Tamanho do radical usado para comparar palavras.
 *
 * Cinco letras fazem "etapa" e "etapas", "cadastro" e "cadastrar", "configuro"
 * e "configurar" caírem no mesmo radical — que é a diferença entre achar o
 * tópico e não achar. Radical menor começaria a juntar palavras que não têm
 * nada a ver ("conta" e "contato" ficariam iguais em quatro letras).
 */
const TAMANHO_DO_RADICAL = 5;

/** Quanto a conversa anterior pode influenciar a pergunta atual. */
const PESO_DO_CONTEXTO = 0.6;

/**
 * Palavras que não distinguem nada.
 *
 * Artigos, preposições e verbos de pergunta estariam em toda pergunta e em
 * quase todo termo: pontuariam todos os tópicos igualmente, que é o mesmo que
 * não pontuar nenhum.
 */
const PALAVRAS_VAZIAS = new Set([
  'a',
  'as',
  'o',
  'os',
  'um',
  'uma',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'por',
  'para',
  'com',
  'sem',
  'que',
  'qual',
  'quais',
  'como',
  'onde',
  'quando',
  'e',
  'ou',
  'eu',
  'meu',
  'minha',
  'meus',
  'minhas',
  'se',
  'ser',
  'esta',
  'este',
  'isso',
  'ao',
  'aos',
  'nao',
  'sim',
  'tem',
  'ter',
  'faz',
  'fazer',
  'vou',
  'posso',
  'pode',
  'deve',
  'mais',
  'muito',
  'aqui',
  'ali',
  'sobre',
  'the',
]);

/**
 * Assistente de ajuda sobre o sistema.
 *
 * Casa a pergunta com um tópico da base de conhecimento e devolve o texto
 * escrito para ele. Não consulta o banco, não chama fornecedor nenhum e não
 * depende das permissões de quem pergunta — explicar como o funil funciona não
 * revela dado de empresa alguma.
 *
 * ## Por que casamento por termos, e não um modelo
 *
 * Dúvida de uso tem resposta certa e estável: "onde cadastro um cliente?" não
 * muda de semana para semana. Um modelo responderia isso com variação, custo e
 * risco de inventar uma tela que não existe. Aqui o texto é escrito uma vez,
 * revisado, e é sempre esse que sai.
 */
@Injectable()
export class AssistenteAjuda {
  responder(pergunta: string, historico: MensagemChat[] = []): RespostaDeAjuda {
    const texto = normalizar(pergunta);

    const social = this.responderSocial(texto);
    if (social) return social;

    const topico = this.melhorTopico(texto, historico);

    if (!topico) {
      return {
        resposta:
          'Não consegui identificar o assunto — mas posso ajudar com:\n\n' +
          ASSUNTOS_PRINCIPAIS.map((assunto) => `• ${assunto}`).join('\n') +
          '\n\nTenta citar a tela ou uma palavra que aparece nela, tipo "orçamento" ou "baixa", que eu acho rapidinho.',
        referencias: [],
        sugestoes: [...SUGESTOES_DE_AJUDA],
        topico: null,
      };
    }

    return {
      resposta: topico.resposta,
      referencias: this.referenciasDe(topico),
      sugestoes: this.sugestoesDe(topico),
      topico,
    };
  }

  /**
   * Cumprimentos e agradecimentos.
   *
   * Sem isso, "oi" cairia no "não entendi", que é a pior primeira impressão
   * possível para quem abriu o chat justamente porque estava perdido.
   */
  private responderSocial(texto: string): RespostaDeAjuda | null {
    const cumprimentos = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'hey'];
    const agradecimentos = ['obrigado', 'obrigada', 'valeu', 'muito bom', 'perfeito', 'ajudou'];
    const capacidades = [
      'o que voce faz',
      'quem e voce',
      'como voce funciona',
      'no que pode ajudar',
      'o que voce pode fazer',
      'me ajuda',
    ];

    if (contemAlgum(texto, capacidades)) {
      return {
        resposta:
          'Sou o assistente de ajuda do sistema. Explico como usar cada tela — onde fica, o que cada campo significa, por que um número aparece daquele jeito.\n\n' +
          'Posso falar sobre:\n\n' +
          ASSUNTOS_PRINCIPAIS.map((assunto) => `• ${assunto}`).join('\n') +
          '\n\nNão consulto os dados da sua empresa nem altero nada. Se quiser conversar sobre os seus números — caixa, funil, propostas —, isso é o assistente com IA do plano Premium.',
        referencias: [{ titulo: 'Planos e assinatura', href: '/painel/plano' }],
        sugestoes: [...SUGESTOES_DE_AJUDA],
        topico: null,
      };
    }

    if (contemAlgum(texto, agradecimentos) && texto.length <= 30) {
      return {
        resposta: 'Por nada! Se aparecer outra dúvida, é só chamar.',
        referencias: [],
        sugestoes: [...SUGESTOES_DE_AJUDA],
        topico: null,
      };
    }

    if (contemAlgum(texto, cumprimentos) && texto.length <= 20) {
      return {
        resposta:
          'Oi! Sou o assistente de ajuda do sistema. Pergunte sobre qualquer tela — clientes, funil, orçamentos, agenda, financeiro, equipe — que eu explico como usar.',
        referencias: [],
        sugestoes: [...SUGESTOES_DE_AJUDA],
        topico: null,
      };
    }

    return null;
  }

  /**
   * O tópico que melhor responde a pergunta.
   *
   * O histórico entra com peso pequeno para resolver a pergunta curta que só
   * faz sentido em sequência: depois de falar de reativação, "e como eu marco
   * o retorno?" deve continuar por ali, e não recomeçar do zero.
   */
  private melhorTopico(texto: string, historico: MensagemChat[]): TopicoAjuda | null {
    const anterior = historico
      .filter((mensagem) => mensagem.autor === 'usuario')
      .slice(-1)
      .map((mensagem) => normalizar(mensagem.texto))[0];

    let escolhido: TopicoAjuda | null = null;
    let melhor = 0;

    for (const indexado of INDICE) {
      const pontos =
        pontuar(texto, indexado) +
        (anterior ? Math.min(pontuar(anterior, indexado), PESO_DO_CONTEXTO) : 0);

      if (pontos > melhor) {
        melhor = pontos;
        escolhido = indexado.topico;
      }
    }

    return melhor >= PONTUACAO_MINIMA ? escolhido : null;
  }

  private referenciasDe(topico: TopicoAjuda): ReferenciaAjuda[] {
    const relacionados = (topico.relacionados ?? [])
      .map((id) => BASE_DE_CONHECIMENTO.find((item) => item.id === id))
      .filter((item): item is TopicoAjuda => item !== undefined);

    return [topico, ...relacionados]
      .slice(0, 3)
      .map((item) => ({ titulo: item.titulo, href: item.href }));
  }

  /**
   * As próximas perguntas.
   *
   * São os títulos dos tópicos relacionados, e não frases inventadas: como o
   * casamento é por termos, clicar num título leva exatamente ao tópico que ele
   * nomeia — a sugestão nunca cai no "não entendi".
   */
  private sugestoesDe(topico: TopicoAjuda): string[] {
    const relacionados = (topico.relacionados ?? [])
      .map((id) => BASE_DE_CONHECIMENTO.find((item) => item.id === id)?.titulo)
      .filter((titulo): titulo is string => titulo !== undefined);

    return relacionados.length > 0 ? relacionados.slice(0, 3) : [...SUGESTOES_DE_AJUDA];
  }
}

interface TopicoIndexado {
  topico: TopicoAjuda;
  /** Radicais de tudo que o tópico responde: termos e título. */
  radicais: Set<string>;
  /** Termos de mais de uma palavra, que valem como expressão inteira. */
  expressoes: string[];
}

/**
 * Quanto a pergunta combina com um tópico.
 *
 * ## Palavra rara vale mais que palavra comum
 *
 * "cliente" aparece em meia dúzia de tópicos; "sumiu" aparece em um. Se as duas
 * valessem igual, "tenho um cliente que sumiu" cairia no cadastro de clientes —
 * era exatamente o que acontecia. Cada radical vale `1/√(tópicos em que
 * aparece)`, então a palavra específica decide e a genérica só desempata.
 *
 * ## Expressão inteira vale mais que as palavras soltas
 *
 * Encontrar "dar baixa" ou "saldo nao bate" na frase é um sinal muito mais
 * forte que encontrar "baixa" e "saldo" em lugares diferentes dela. Por isso a
 * expressão literal soma o próprio número de palavras por cima.
 */
function pontuar(texto: string, indexado: TopicoIndexado): number {
  const radicais = new Set(radicaisDe(texto));

  let pontos = 0;

  for (const radical of radicais) {
    if (indexado.radicais.has(radical)) {
      pontos += 1 / Math.sqrt(TOPICOS_POR_RADICAL.get(radical) ?? 1);
    }
  }

  for (const expressao of indexado.expressoes) {
    if (contemExpressao(texto, expressao)) {
      pontos += expressao.split(' ').length;
    }
  }

  return pontos;
}

/**
 * Índice montado uma vez, na carga do módulo.
 *
 * Refazer a contagem de radicais a cada pergunta custaria percorrer a base
 * inteira para produzir sempre o mesmo resultado — ela só muda quando alguém
 * edita o arquivo de conteúdo.
 */
const INDICE: readonly TopicoIndexado[] = BASE_DE_CONHECIMENTO.map((topico) => ({
  topico,
  radicais: new Set([
    ...topico.termos.flatMap((termo) => radicaisDe(termo)),
    ...radicaisDe(normalizar(topico.titulo)),
  ]),
  expressoes: topico.termos.filter((termo) => termo.includes(' ')),
}));

const TOPICOS_POR_RADICAL = contarTopicosPorRadical(INDICE);

function contarTopicosPorRadical(indice: readonly TopicoIndexado[]): Map<string, number> {
  const contagem = new Map<string, number>();

  for (const indexado of indice) {
    for (const radical of indexado.radicais) {
      contagem.set(radical, (contagem.get(radical) ?? 0) + 1);
    }
  }

  return contagem;
}

/**
 * As palavras de um texto reduzidas ao radical, sem as que não distinguem nada.
 *
 * Artigos e preposições são removidos porque estariam em toda pergunta e em
 * quase todo termo — pontuariam todos os tópicos igualmente, que é o mesmo que
 * não pontuar nenhum.
 */
function radicaisDe(texto: string): string[] {
  return texto
    .split(' ')
    .filter((palavra) => palavra.length > 1 && !PALAVRAS_VAZIAS.has(palavra))
    .map((palavra) => palavra.slice(0, TAMANHO_DO_RADICAL));
}

/**
 * A expressão aparece como sequência de palavras inteiras.
 *
 * Por substring, "ia" casaria dentro de "financeira" e mandaria toda pergunta
 * sobre caixa para o tópico de IA.
 */
function contemExpressao(texto: string, expressao: string): boolean {
  return new RegExp(`(^|\\s)${escapar(expressao)}(\\s|$)`).test(texto);
}

/** Um termo de uma palavra só, comparado inteiro. */
function contemPalavra(texto: string, termo: string): boolean {
  return new RegExp(`(^|\\s)${escapar(termo)}(\\s|$)`).test(texto);
}

function contemAlgum(texto: string, termos: string[]): boolean {
  return termos.some((termo) => contemPalavra(texto, termo));
}

function escapar(termo: string): string {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deixa a pergunta comparável: sem acento, sem pontuação e com espaço simples.
 *
 * Quem digita com pressa escreve "orcamento", "pro labore" e "nao bate". Tirar
 * acento e pontuação antes de comparar é o que faz esses três acharem o tópico
 * certo sem precisar de uma entrada para cada grafia.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
