import {
  Bell,
  CalendarDays,
  Camera,
  Contact,
  FileText,
  KanbanSquare,
  MessageSquareText,
  Sparkles,
  TrendingUp,
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
 * o mês fechou no azul e por que aquele orçamento não voltou. Por isso o texto
 * evita palavra de catálogo de software e descreve situação — o que acontece
 * hoje, e o que passa a acontecer.
 */

export interface Recurso {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

export const RECURSOS: readonly Recurso[] = [
  {
    icone: Contact,
    titulo: 'Seus clientes num lugar só',
    descricao:
      'Tudo que já foi feito para cada cliente fica registrado na ficha dele: serviços, valores e datas. Antes de ligar, você lê em dez segundos o que aconteceu da última vez.',
  },
  {
    icone: KanbanSquare,
    titulo: 'Nenhuma negociação esquecida',
    descricao:
      'Um quadro simples mostra em que pé está cada conversa e há quantos dias ela não anda. O que travou aparece em destaque, em vez de sumir no meio da lista.',
  },
  {
    icone: FileText,
    titulo: 'Orçamentos que se movem sozinhos',
    descricao:
      'Você faz a proposta e ela já entra na sua lista de negociações. Quando o cliente aprova, o sistema atualiza tudo — você não precisa lembrar de arrastar nada.',
  },
  {
    icone: CalendarDays,
    titulo: 'Agenda ligada ao serviço',
    descricao:
      'O que foi vendido vira compromisso marcado. Ao dar como feito, o serviço entra no histórico do cliente sem você digitar de novo.',
  },
  {
    icone: Bell,
    titulo: 'O retorno acontece no dia certo',
    descricao:
      'Marque quando falar de novo com alguém e pode esquecer: o lembrete chega sozinho. Aquele orçamento que ficou sem resposta deixa de morrer no silêncio.',
  },
  {
    icone: Wallet,
    titulo: 'Você descobre o que dá lucro',
    descricao:
      'O dinheiro que entra e sai fica ligado ao serviço que o gerou. Aí o sistema responde a pergunta que planilha nenhuma responde: qual trabalho seu realmente compensa.',
  },
];

export interface Passo {
  titulo: string;
  descricao: string;
}

/**
 * O encadeamento que sustenta a promessa do produto: cada passo alimenta o
 * seguinte, e é isso que permite calcular margem sem digitação repetida.
 */
export const PASSOS: readonly Passo[] = [
  {
    titulo: 'Chega um cliente',
    descricao:
      'Você cadastra e faz o orçamento. Só isso já coloca a negociação no seu quadro de acompanhamento.',
  },
  {
    titulo: 'O cliente aprova',
    descricao:
      'A proposta aprovada vira compromisso na agenda, já com o serviço e o custo que ele tem para você.',
  },
  {
    titulo: 'O trabalho é feito',
    descricao:
      'Você registra o que recebeu. Nesse momento o sistema já sabe quanto aquele serviço custou e quanto sobrou.',
  },
  {
    titulo: 'A conta aparece pronta',
    descricao:
      'Sem fechar planilha no fim do mês: a margem de cada tipo de serviço está calculada desde o primeiro lançamento.',
  },
];

/**
 * Recursos de inteligência artificial.
 *
 * ## Estes recursos ainda NÃO existem
 *
 * Nada aqui está implementado. A seção descreve o que está sendo construído, e
 * a página deixa isso explícito — cada item leva o rótulo "em breve" e o texto
 * de abertura diz com todas as letras que é o próximo passo, não o que a pessoa
 * encontra ao entrar hoje.
 *
 * Isso não é excesso de zelo. Quem assina um teste esperando conversar com a IA
 * e não encontra nada cancela na primeira hora — e não volta. Anunciar o que
 * vem, dizendo que vem, constrói expectativa sem queimar a confiança.
 *
 * Ao implementar cada um, mova o item para `RECURSOS` e tire daqui.
 */
export interface RecursoIA {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  /** A pergunta do dono que este recurso responde, nas palavras dele. */
  pergunta: string;
  disponivel?: boolean;
}

export const RECURSOS_IA: readonly RecursoIA[] = [
  {
    icone: TrendingUp,
    titulo: 'Previsão do fluxo de caixa',
    pergunta: '“Meu caixa aguenta os próximos meses?”',
    descricao:
      'Cruza o histórico com contas já previstas, projeta o saldo dos próximos meses e explica os riscos e ações em linguagem simples.',
    disponivel: true,
  },
  {
    icone: MessageSquareText,
    titulo: 'Pergunte em português',
    pergunta: '"Quanto gastei com combustível nos últimos três meses?"',
    descricao:
      'Em vez de montar filtro e relatório, você escreve a pergunta como falaria com o contador. A resposta vem com os números do seu negócio, não com um manual de como encontrá-los.',
  },
  {
    icone: Camera,
    titulo: 'Fotografe a nota',
    pergunta: '"Tenho um monte de recibo para lançar e nunca sobra tempo."',
    descricao:
      'Tire uma foto do comprovante e o lançamento aparece preenchido: valor, data e categoria. Você confere e confirma — o trabalho vira conferir, não digitar.',
  },
  {
    icone: TrendingUp,
    titulo: 'Sugestão de preço',
    pergunta: '"Será que estou cobrando barato demais nesse serviço?"',
    descricao:
      'A partir do que você realmente gastou e recebeu em cada tipo de trabalho, o sistema aponta onde o preço não está cobrindo o custo — e quanto seria preciso cobrar para fechar a conta.',
  },
  {
    icone: Bell,
    titulo: 'Aviso do que vai esfriar',
    pergunta: '"Aquele orçamento sumiu e eu nem percebi."',
    descricao:
      'Comparando com o que costuma acontecer no seu histórico, o sistema avisa quais negociações estão perdendo força a tempo de você agir — em vez de descobrir depois que o cliente fechou com outro.',
  },
  {
    icone: MessageSquareText,
    titulo: 'Mensagem pronta para enviar',
    pergunta: '"Nunca sei como cobrar sem parecer chato."',
    descricao:
      'O sistema escreve o retorno para você, já sabendo quem é o cliente e o que foi combinado. Você lê, ajusta o que quiser e manda.',
  },
  {
    icone: Sparkles,
    titulo: 'Resumo antes da conversa',
    pergunta: '"O cliente ligou e eu não lembro o que combinamos."',
    descricao:
      'Um parágrafo curto com o essencial daquele cliente: o que já foi feito, o que está em aberto e o que ficou pendente da última vez.',
  },
];

/** Dias de teste — espelha `ONBOARDING_TRIAL_DIAS` no ambiente da API. */
export const DIAS_DE_TESTE = 14;
