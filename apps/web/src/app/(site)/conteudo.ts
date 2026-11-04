import { DIAS_PARA_EXCLUIR_CONTA_CANCELADA } from '@gestao/shared-types';
import {
  Bell,
  CalendarCheck,
  Contact,
  Database,
  FileText,
  KanbanSquare,
  KeyRound,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Texto e dados da página inicial.
 *
 * Separado da página de propósito: ajustar uma frase de venda é o tipo de coisa
 * que acontece toda semana, e não deveria exigir navegar por JSX para achar
 * onde o texto está. Aqui é tudo dado; lá é só apresentação.
 *
 * ## Sobre o tom
 *
 * Quem lê esta página é dono de oficina, de clínica pequena, de empresa de
 * manutenção. Ele não procura "gestão integrada de processos": procura saber se
 * o mês fechou no azul e por que aquele orçamento não voltou. O tom é o de um
 * sócio experiente: frases curtas, situações reais, nenhuma palavra de catálogo
 * de software.
 *
 * Termo de finanças ("margem", "fluxo de caixa") aparece sempre com a
 * explicação por perto — aqui, em `TERMOS`, que a página mostra num balão. O
 * leitor que não conhece a palavra não pergunta: fecha a aba.
 *
 * ## Regra: só afirme o que o código faz
 *
 * Esta página já prometeu que "aprovar o orçamento cria o compromisso na
 * agenda". Não cria: aprovar move o cliente no funil, e quem marca o horário é
 * a pessoa. A promessa só foi percebida quando alguém abriu o código para
 * escrever a história de ponta a ponta — e o cliente que acreditasse nela
 * descobriria o erro na primeira semana de uso.
 *
 * Antes de escrever "o sistema faz X sozinho", confira no serviço que faz X.
 * Os exemplos de `JORNADA` seguem o que `OrcamentosService`,
 * `AgendamentosService` e `FinanceiroService` realmente executam; as etapas do
 * funil de demonstração são as que o cadastro cria (`ETAPAS_FUNIL_PADRAO`).
 *
 * Números de demonstração (mockups e funil) são de exemplo e a página diz isso.
 * Mesmo assim eles **fecham entre si**: o que é soma é calculado, não digitado.
 */

export function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR')}`;
}

// ─── Hero ───────────────────────────────────────────────────────────────────

export const HERO = {
  rotulo: 'Para quem vende serviço',
  /** O título tem duas partes: a segunda vai em itálico, na cor de acento. */
  titulo: 'Saiba quanto sobra de cada serviço.',
  enfase: 'Sem planilha.',
  subtitulo:
    'Clientes, orçamentos, agenda e dinheiro num lugar só. O que você registra num canto já aparece nos outros.',
  chamada: 'Testar grátis por 14 dias',
  secundaria: 'Ver como funciona',
  garantias: ['14 dias grátis', 'Sem cartão de crédito', 'Cancele quando quiser'],
} as const;

/**
 * Para quem é. Os mesmos negócios que a resposta "Funciona para o meu tipo de
 * negócio?" cita — a página não pode prometer um público na faixa e outro na
 * dúvida.
 */
export const PARA_QUEM = {
  rotulo: 'Feito para',
  negocios: ['Oficinas', 'Clínicas', 'Assistências técnicas', 'Instaladores'],
  complemento: 'E todo negócio que faz orçamento, marca horário e volta a falar com o cliente.',
} as const;

// ─── Cabeçalhos das seções ─────────────────────────────────────────────────

/** Título de seção em duas partes: a `enfase` vai em itálico, na cor de acento. */
export interface CabecalhoDeSecao {
  rotulo: string;
  titulo: string;
  enfase: string;
  intro?: string;
}

export const SECOES = {
  comoFunciona: {
    rotulo: 'Como funciona',
    titulo: 'Três passos.',
    enfase: 'Nenhuma planilha.',
    intro:
      'O que você registra numa etapa já é usado nas seguintes. É por isso que a conta fecha sozinha.',
  },
  pontaAPonta: {
    rotulo: 'De ponta a ponta',
    titulo: 'Siga um serviço, do telefonema à',
    enfase: 'conta fechada.',
    // Sem o valor aqui: ele aparece na primeira etapa, vindo de `CONTA_DO_EXEMPLO`.
    intro:
      'A Maria quer instalar um ar-condicionado. Role a página e veja, etapa por etapa, onde o sistema trabalha por você.',
  },
  funil: {
    rotulo: 'Na prática',
    titulo: 'Arraste um cliente.',
    enfase: 'A conta acompanha.',
    intro:
      'Este é o quadro de negociações, com etapas que o sistema já cria para você. Mova os clientes e veja os totais mudarem.',
  },
  recursos: {
    rotulo: 'O dia a dia',
    titulo: 'Seis situações que você conhece.',
    enfase: 'Resolvidas.',
  },
  seguranca: {
    rotulo: 'Segurança',
    titulo: 'Seus dados são só seus.',
    enfase: 'Testado, não prometido.',
    intro:
      'A separação entre empresas foi construída antes de qualquer tela, e é verificada por testes que tentam violá-la.',
  },
  planos: {
    rotulo: 'Preço',
    titulo: 'Dois planos.',
    enfase: 'Sem letra miúda.',
    intro: 'Os 14 dias de teste valem para os dois, com tudo do plano escolhido.',
  },
  duvidas: {
    rotulo: 'Dúvidas',
    titulo: 'O que costumam perguntar',
    enfase: 'antes de testar.',
    intro: 'Respostas diretas, inclusive sobre o que o sistema não faz.',
  },
} as const satisfies Record<string, CabecalhoDeSecao>;

// ─── Termos explicados num balão ───────────────────────────────────────────

/**
 * As definições são as mesmas do botão "?" do painel (`lib/glossario.ts`),
 * em tom de conversa. Se uma fórmula mudar no sistema, mude nos dois lugares.
 */
export const TERMOS = {
  margem: {
    rotulo: 'margem',
    explicacao:
      'O que sobra de um serviço depois de pagar o que ele custou. Cobrou R$ 100 e gastou R$ 40? A margem é R$ 60, ou 60%.',
  },
  fluxoDeCaixa: {
    rotulo: 'fluxo de caixa',
    explicacao:
      'O vaivém do dinheiro: quanto entrou e quanto saiu num período. Não é lucro, nem o saldo do banco.',
  },
} as const;

export type ChaveTermo = keyof typeof TERMOS;

/** Texto com termos explicados no meio: cada pedaço é texto ou um termo. */
export type TextoComTermos = readonly (string | { termo: ChaveTermo })[];

// ─── Como funciona: três passos ────────────────────────────────────────────

export interface Passo {
  titulo: string;
  descricao: TextoComTermos;
}

export const PASSOS: readonly Passo[] = [
  {
    titulo: 'Cadastre clientes e serviços',
    descricao: [
      'Do cliente, só o nome é obrigatório. Já tem tudo numa planilha? O sistema importa, confere e pula os repetidos.',
    ],
  },
  {
    titulo: 'Orce, agende e execute',
    descricao: [
      'O orçamento leva o cliente pelo quadro de negociações sozinho. Um clique em “executado” registra o serviço e tira do estoque o material usado.',
    ],
  },
  {
    titulo: 'Veja quanto sobrou',
    descricao: [
      'O financeiro já mostra a ',
      { termo: 'margem' },
      ' de cada serviço e o ',
      { termo: 'fluxoDeCaixa' },
      ' do período. Ninguém monta relatório no fim do mês.',
    ],
  },
];

// ─── Um serviço de ponta a ponta ───────────────────────────────────────────

/**
 * O exemplo que atravessa a página: um serviço, do telefonema à conta fechada.
 *
 * A sobra e o percentual **saem da soma** abaixo, e não são digitados: se
 * alguém trocar o valor do material e esquecer de ajustar o resto, os textos
 * continuam fechando.
 *
 * Os três custos correspondem às três fontes que o relatório de margem soma de
 * verdade: o material que baixou do estoque, a comissão e as despesas
 * lançadas e ligadas ao serviço.
 */
export const CONTA_DO_EXEMPLO = {
  servico: 'Instalação de ar-condicionado',
  receita: 980,
  custos: [
    { rotulo: 'Material usado, que saiu do estoque', valor: 210 },
    { rotulo: 'Comissão de quem instalou', valor: 100 },
    { rotulo: 'Combustível, lançado como despesa do serviço', valor: 100 },
  ],
} as const;

export function resumirContaDoExemplo() {
  const custo = CONTA_DO_EXEMPLO.custos.reduce((soma, item) => soma + item.valor, 0);
  const sobra = CONTA_DO_EXEMPLO.receita - custo;

  return {
    custo,
    sobra,
    percentual: Math.round((sobra / CONTA_DO_EXEMPLO.receita) * 100),
  };
}

export interface EtapaDaJornada {
  /** Uma palavra, para a linha do tempo. */
  etapa: string;
  titulo: string;
  voceFaz: string;
  sistemaFaz: string;
  /** Mostra a conta da sobra, linha a linha, no fim da etapa. */
  mostraConta?: boolean;
}

const RECEITA = reais(CONTA_DO_EXEMPLO.receita);

/**
 * A história de ponta a ponta, na ordem em que acontece.
 *
 * Detalhes que a história respeita de propósito:
 *
 * - **Aprovar não agenda.** O horário é marcado por quem usa; a etapa "Agenda"
 *   existe justamente para não sugerir o contrário.
 * - **O recebimento é opcional ao executar.** Quem executa pode não ter acesso
 *   ao financeiro; por isso o texto diz "informa se foi recebido".
 * - **A despesa de combustível é lançada por quem paga.** O sistema não
 *   adivinha gasto: só soma o que está ligado ao serviço.
 */
export const JORNADA: readonly EtapaDaJornada[] = [
  {
    etapa: 'Orçamento',
    titulo: 'A Maria liga pedindo uma instalação',
    voceFaz: `Cadastra a Maria e faz o orçamento de ${RECEITA}.`,
    sistemaFaz: `Coloca a Maria no quadro de negociações, na etapa de orçamento enviado, e soma os ${RECEITA} ao que você tem em negociação.`,
  },
  {
    etapa: 'Aprovação',
    titulo: 'A Maria aceita',
    voceFaz: 'Marca o orçamento como aprovado.',
    sistemaFaz:
      'Move a Maria para fechado e trava o valor da proposta, para ninguém alterar sem querer um combinado já fechado.',
  },
  {
    etapa: 'Agenda',
    titulo: 'Você marca o dia do serviço',
    voceFaz: 'Escolhe a Maria, o serviço do seu catálogo, o dia e a hora.',
    sistemaFaz:
      'Mostra o compromisso na agenda e no painel. Se a hora passar e o serviço não for feito, ele aparece como atrasado.',
  },
  {
    etapa: 'Execução',
    titulo: 'O serviço é feito',
    voceFaz: `Marca como executado, confere o material usado e informa se os ${RECEITA} já foram recebidos.`,
    sistemaFaz:
      'Tudo de uma vez: registra o serviço no histórico da Maria, tira o material do estoque, calcula a comissão de quem fez e lança o valor no financeiro, ligado a esse serviço.',
  },
  {
    etapa: 'Financeiro',
    titulo: 'No fim do mês, a conta já está pronta',
    voceFaz: 'Lançou a despesa de combustível ligada à instalação. Fora isso, nada.',
    sistemaFaz:
      'Soma o que entrou com tudo o que esse serviço custou e mostra a sobra de cada tipo de serviço, lado a lado.',
    mostraConta: true,
  },
];

// ─── Mockup do painel (hero) ───────────────────────────────────────────────

/**
 * Os serviços do mês no mockup. A instalação é a mesma da jornada: três delas,
 * com o mesmo custo por unidade, então a margem é idêntica nas duas seções.
 */
const CUSTO_INSTALACAO = resumirContaDoExemplo().custo;

export const SERVICOS_DO_MES = [
  {
    nome: CONTA_DO_EXEMPLO.servico,
    receita: CONTA_DO_EXEMPLO.receita * 3,
    custo: CUSTO_INSTALACAO * 3,
  },
  { nome: 'Manutenção preventiva', receita: 1900, custo: 520 },
  { nome: 'Higienização', receita: 960, custo: 610 },
] as const;

export function resumirMes() {
  const recebido = SERVICOS_DO_MES.reduce((soma, s) => soma + s.receita, 0);
  const custo = SERVICOS_DO_MES.reduce((soma, s) => soma + s.custo, 0);

  return {
    recebido,
    sobra: recebido - custo,
    servicos: SERVICOS_DO_MES.map((servico) => ({
      ...servico,
      margem: Math.round(((servico.receita - servico.custo) / servico.receita) * 100),
    })).sort((a, b) => b.margem - a.margem),
  };
}

export const AGENDA_DE_HOJE = [
  { hora: '09:00', servico: 'Instalação', cliente: 'Maria Souza' },
  { hora: '14:30', servico: 'Higienização', cliente: 'Carlos Lima' },
] as const;

// ─── Funil interativo ──────────────────────────────────────────────────────

/**
 * Quatro das etapas que o cadastro cria para toda empresa nova
 * (`ETAPAS_FUNIL_PADRAO`, na API). "Fechado" é a de marco: é para ela que o
 * orçamento aprovado leva o cliente sozinho.
 */
export const COLUNAS_FUNIL = ['Novo contato', 'Orçamento enviado', 'Follow-up', 'Fechado'] as const;

export type ColunaFunil = (typeof COLUNAS_FUNIL)[number];

export interface CartaoFunil {
  id: string;
  cliente: string;
  servico: string;
  valor: number;
  coluna: ColunaFunil;
  /** Parado há 7 dias ou mais: o sistema destaca. */
  parado?: boolean;
}

export const CARTOES_FUNIL: readonly CartaoFunil[] = [
  {
    id: 'rafael',
    cliente: 'Rafael Costa',
    servico: 'Manutenção preventiva',
    valor: 380,
    coluna: 'Novo contato',
  },
  {
    id: 'juliana',
    cliente: 'Juliana Prado',
    servico: 'Higienização',
    valor: 240,
    coluna: 'Novo contato',
  },
  {
    id: 'maria',
    cliente: 'Maria Souza',
    servico: CONTA_DO_EXEMPLO.servico,
    valor: CONTA_DO_EXEMPLO.receita,
    coluna: 'Orçamento enviado',
  },
  {
    id: 'clinica',
    cliente: 'Clínica Bem-Estar',
    servico: 'Instalação de 3 aparelhos',
    valor: 2700,
    coluna: 'Orçamento enviado',
  },
  {
    id: 'carlos',
    cliente: 'Carlos Lima',
    servico: 'Higienização',
    valor: 240,
    coluna: 'Follow-up',
    parado: true,
  },
  {
    id: 'padaria',
    cliente: 'Padaria Trigo Bom',
    servico: 'Manutenção preventiva',
    valor: 760,
    coluna: 'Fechado',
  },
  {
    id: 'ana',
    cliente: 'Ana Ribeiro',
    servico: 'Instalação de ar-condicionado',
    valor: 1180,
    coluna: 'Fechado',
  },
];

/** Totais do funil: fechado de um lado, todo o resto "em negociação". */
export function totaisDoFunil(cartoes: readonly Pick<CartaoFunil, 'valor' | 'coluna'>[]) {
  return cartoes.reduce(
    (totais, cartao) => {
      if (cartao.coluna === 'Fechado') totais.fechado += cartao.valor;
      else totais.emNegociacao += cartao.valor;
      return totais;
    },
    { fechado: 0, emNegociacao: 0 },
  );
}

// ─── Recursos ──────────────────────────────────────────────────────────────

export type VisualRecurso =
  'clientes' | 'negociacoes' | 'orcamentos' | 'execucao' | 'retorno' | 'margem';

export interface Recurso {
  icone: LucideIcon;
  visual: VisualRecurso;
  titulo: string;
  /** A dúvida do dono, nas palavras dele — o gancho que faz ele querer ler o resto. */
  pergunta: string;
  descricao: string;
}

export const RECURSOS: readonly Recurso[] = [
  {
    icone: Contact,
    visual: 'clientes',
    titulo: 'Seus clientes num lugar só',
    pergunta: '“O que eu combinei com ele da última vez?”',
    descricao:
      'A ficha de cada cliente guarda serviços, valores, datas e o que você anotou. Você lê o histórico em dez segundos.',
  },
  {
    icone: KanbanSquare,
    visual: 'negociacoes',
    titulo: 'Nenhuma negociação esquecida',
    pergunta: '“Aquele orçamento deu em quê?”',
    descricao:
      'Cada cliente aparece na etapa em que está. Quem está parado há 7 dias ou mais ganha destaque.',
  },
  {
    icone: FileText,
    visual: 'orcamentos',
    titulo: 'Orçamentos que movem o quadro',
    pergunta: '“Esqueci de mudar o cliente de etapa.”',
    descricao:
      'Orçamento enviado leva o cliente para a proposta; aprovado, para fechado. Ninguém arrasta cartão à mão.',
  },
  {
    icone: CalendarCheck,
    visual: 'execucao',
    titulo: 'Do serviço marcado ao registrado',
    pergunta: '“Fiz o serviço… e agora lanço tudo de novo?”',
    descricao:
      'Um clique em “executado” registra o atendimento, baixa o material do estoque e, se quiser, lança o recebimento.',
  },
  {
    icone: Bell,
    visual: 'retorno',
    titulo: 'O retorno no dia certo',
    pergunta: '“Prometi ligar de novo e passou um mês.”',
    descricao:
      'Na data marcada, o sistema envia o lembrete por e-mail ao cliente, em nome da sua empresa.',
  },
  {
    icone: Wallet,
    visual: 'margem',
    titulo: 'Você descobre o que dá lucro',
    pergunta: '“Qual serviço meu realmente compensa?”',
    descricao:
      'Cada real que entra e sai fica ligado ao serviço. O sistema mostra quais deixam mais sobra, sem planilha.',
  },
];

// ─── Segurança ─────────────────────────────────────────────────────────────

export interface Garantia {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

export const GARANTIAS: readonly Garantia[] = [
  {
    icone: Database,
    titulo: 'Os dados da sua empresa são só seus',
    descricao:
      'O próprio banco de dados recusa o acesso de qualquer outra empresa, e testes automáticos tentam violar isso a cada mudança.',
  },
  {
    icone: KeyRound,
    titulo: 'Cada pessoa vê o que precisa',
    descricao:
      'Você dá a cada um da equipe um papel e as permissões que quiser. Quem atende cliente não vê quanto a empresa fatura.',
  },
  {
    icone: ShieldCheck,
    titulo: 'Entrada em duas etapas e LGPD',
    descricao: `Senha mais um código do celular. O dono exporta tudo quando quiser; ao cancelar, os dados são apagados em definitivo em ${DIAS_PARA_EXCLUIR_CONTA_CANCELADA} dias.`,
  },
];

// ─── Planos ────────────────────────────────────────────────────────────────

export interface Plano {
  /** "Premium", e não "Pro": é o nome que a conta mostra depois de assinar. */
  nome: string;
  preco: number;
  resumo: string;
  itens: readonly string[];
  destaque?: boolean;
}

export const PLANOS: readonly Plano[] = [
  {
    nome: 'Básico',
    preco: 100,
    resumo: 'Clientes, orçamentos, agenda e financeiro organizados.',
    itens: [
      '2 usuários incluídos',
      'Até 5 usuários · R$ 20 por adicional',
      '500 clientes',
      'Clientes, orçamentos, agenda e financeiro',
      'Importação e exportação de dados',
    ],
  },
  {
    nome: 'Premium',
    preco: 200,
    resumo: 'Mais equipe, mais clientes e inteligência artificial sobre os seus números.',
    destaque: true,
    itens: [
      '5 usuários incluídos',
      'Até 20 usuários · R$ 15 por adicional',
      '3.000 clientes',
      'Tudo do Básico',
      'Assistente com IA sobre os seus números',
      'Previsão financeira com IA',
      '200 previsões por mês',
    ],
  },
];

export const DEFINICOES_DOS_PLANOS = [
  {
    termo: 'Usuário',
    definicao: 'Cada pessoa da equipe com login próprio. Você decide o que cada uma enxerga.',
  },
  {
    termo: 'Previsão',
    definicao: 'Cada vez que você pede à IA para projetar o seu caixa dos próximos meses.',
  },
] as const;

// ─── Dúvidas ───────────────────────────────────────────────────────────────

/**
 * As cinco dúvidas que mais travam o cadastro.
 *
 * Duas delas dizem com franqueza o que o produto **não** faz (venda de balcão,
 * nota fiscal). É de propósito: quem descobre um limite depois de assinar
 * cancela; quem lê aqui e assina assim mesmo é o cliente certo. Segurança e
 * permissões têm seção própria, por isso não se repetem aqui.
 */
export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export const PERGUNTAS: readonly Pergunta[] = [
  {
    pergunta: 'Preciso entender de finanças ou de tecnologia?',
    resposta:
      'Não. Ao lado dos números importantes há um botão “?” que explica, em palavras simples, o que cada um significa e como é calculado. E o painel inicial mostra primeiro o que precisa da sua atenção hoje.',
  },
  {
    pergunta: 'Funciona para o meu tipo de negócio?',
    resposta:
      'Foi pensado para quem vende serviço: faz orçamento, marca horário e volta a falar com o cliente, como oficinas, clínicas, assistências técnicas e instaladores. Se o seu negócio é só vender produto no balcão, ele não foi feito para isso.',
  },
  {
    pergunta: 'Já tenho meus clientes numa planilha. Dá para trazer?',
    resposta:
      'Dá. Você envia a planilha (Excel ou CSV), o sistema mostra uma conferência antes de importar e pula as linhas repetidas, mesmo CPF, CNPJ ou e-mail, dizendo o motivo. Os lançamentos financeiros também entram por planilha.',
  },
  {
    pergunta: 'O sistema emite nota fiscal ou calcula imposto?',
    resposta:
      'Não. Ele guarda a nota, o boleto e o comprovante anexados a cada lançamento, e mostra caixa e margem. A emissão de nota e os impostos continuam com o seu contador.',
  },
  {
    pergunta: 'O teste grátis pede cartão? E depois dos 14 dias?',
    resposta:
      'Não pede cartão. São 14 dias para usar com tudo do plano escolhido. Se decidir ficar, o plano é mensal; se não, o dono cancela a conta pelo próprio sistema.',
  },
];

// ─── Chamada final ─────────────────────────────────────────────────────────

export const CHAMADA_FINAL = {
  titulo: 'Comece pela pergunta que importa:',
  enfase: 'quanto sobrou?',
  texto:
    'Cadastre o primeiro cliente e faça um orçamento. É o bastante para o quadro e o painel começarem a se mexer.',
  chamada: 'Testar grátis por 14 dias',
  observacao: 'Sem cartão de crédito · cancele quando quiser',
} as const;
