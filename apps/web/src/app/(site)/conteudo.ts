import {
  Bell,
  Boxes,
  CalendarDays,
  Camera,
  Contact,
  FileText,
  KanbanSquare,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  Users,
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
 *
 * Termo de finanças ou de sistema ("margem", "fluxo de caixa", "pró-labore",
 * "CRM") aparece sempre com a explicação por perto. O leitor que não conhece a
 * palavra não pergunta: fecha a aba.
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
 * `AgendamentosService` e `FinanceiroService` realmente executam.
 */

export interface Recurso {
  icone: LucideIcon;
  titulo: string;
  /** A dúvida do dono, nas palavras dele — o gancho que faz ele querer ler o resto. */
  pergunta: string;
  descricao: string;
}

export const RECURSOS: readonly Recurso[] = [
  {
    icone: Contact,
    titulo: 'Seus clientes num lugar só',
    pergunta: '“O que eu combinei com ele da última vez?”',
    descricao:
      'Cada cliente tem uma ficha com tudo o que já aconteceu: serviços feitos, valores, datas e as conversas que você anotou. Antes de ligar, você lê o histórico em dez segundos, sem caçar mensagem antiga nem folhear caderno.',
  },
  {
    icone: KanbanSquare,
    titulo: 'Nenhuma negociação esquecida',
    pergunta: '“Aquele orçamento deu em quê?”',
    descricao:
      'Um quadro mostra cada cliente na etapa em que está, do primeiro contato ao fechamento, como post-its numa parede, só que organizados. Quem está parado há 7 dias ou mais ganha destaque, e o painel avisa.',
  },
  {
    icone: FileText,
    titulo: 'Orçamentos que atualizam o quadro sozinhos',
    pergunta: '“Esqueci de mudar o cliente de etapa.”',
    descricao:
      'Você faz o orçamento e o cliente já vai para a etapa de proposta enviada. Quando ele aceita e você marca como aprovado, vai para fechado e o valor entra nos seus números do mês. Ninguém precisa arrastar cartão à mão.',
  },
  {
    icone: CalendarDays,
    titulo: 'Do serviço marcado ao serviço registrado',
    pergunta: '“Fiz o serviço… e agora tenho que lançar tudo de novo?”',
    descricao:
      'Você marca o serviço na agenda, com cliente, dia e hora. Depois de feito, um clique em “executado” registra o atendimento no histórico do cliente, tira do estoque o material usado e, se você quiser, já lança o dinheiro recebido.',
  },
  {
    icone: Bell,
    titulo: 'O retorno acontece no dia certo',
    pergunta: '“Prometi ligar de novo e passou um mês.”',
    descricao:
      'Você marca a data do próximo contato. Nesse dia, o sistema envia um e-mail ao cliente (que tenha e-mail cadastrado), em nome da sua empresa, e o painel mostra o que está pendente ou atrasado, e você não depende da memória.',
  },
  {
    icone: Wallet,
    titulo: 'Você descobre o que dá lucro',
    pergunta: '“Qual serviço meu realmente compensa?”',
    descricao:
      'O dinheiro que entra e o que sai ficam ligados ao serviço que os gerou. Assim o sistema separa o que cada serviço rendeu do que ele custou, como material, comissão e despesas, e mostra quais deixam mais sobra, sem você montar planilha.',
  },
];

/**
 * O exemplo que atravessa a página: um serviço, do telefonema à conta fechada.
 *
 * Os mesmos números alimentam a jornada, o quadro de resultado e a conta final.
 * A sobra e o percentual **saem da soma** abaixo, e não são digitados: se
 * alguém trocar o valor do material e esquecer de ajustar o resto, os textos
 * continuam fechando. É o mesmo cuidado do `PainelResultado`, e pelo mesmo
 * motivo — uma página que diz "a conta se faz sozinha" não pode ter a conta
 * errada.
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

export function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR')}`;
}

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
  titulo: string;
  /** Uma linha, visível com a etapa fechada: o que desperta a vontade de abrir. */
  chamada: string;
  voceFaz: string;
  sistemaFaz: string;
  voceVe: string;
  /** Mostra a conta da sobra, linha a linha, no fim da etapa. */
  mostraConta?: boolean;
}

const RECEITA = reais(CONTA_DO_EXEMPLO.receita);
const CONTA = resumirContaDoExemplo();

/**
 * A história de ponta a ponta, na ordem em que acontece.
 *
 * Cada etapa responde às três perguntas de quem está avaliando o sistema: *o
 * que eu vou ter que fazer?*, *o que ele faz por mim?* e *o que eu ganho com
 * isso?*. A segunda é a que vende — e por isso cada frase dela corresponde a
 * algo que o código executa (veja a nota sobre veracidade, no topo).
 *
 * Detalhes que a história respeita de propósito:
 *
 * - **Aprovar não agenda.** O horário é marcado por quem usa; a etapa 3 existe
 *   justamente para não sugerir o contrário.
 * - **O recebimento é opcional ao executar.** Quem executa pode não ter acesso
 *   ao financeiro; por isso o texto diz "informa se foi recebido", e não que o
 *   dinheiro é lançado sempre.
 * - **A despesa de combustível é lançada por quem paga.** O sistema não
 *   adivinha gasto: só soma o que está ligado ao serviço.
 */
export const JORNADA: readonly EtapaDaJornada[] = [
  {
    titulo: 'A Maria liga pedindo uma instalação',
    chamada: 'Você anota quem ela é e quanto vai cobrar.',
    voceFaz: `Cadastra a Maria, só o nome é obrigatório, e faz o orçamento de ${RECEITA} para a instalação do ar-condicionado.`,
    sistemaFaz: `Coloca a Maria no quadro de negociações, na etapa de proposta enviada, e soma os ${RECEITA} ao total que você tem em negociação.`,
    voceVe: `No painel inicial, “Em negociação” sobe ${RECEITA}. Você não precisou atualizar nenhuma outra tela.`,
  },
  {
    titulo: 'A Maria aceita o orçamento',
    chamada: 'Você marca a proposta como aprovada.',
    voceFaz: 'Marca o orçamento como aprovado.',
    sistemaFaz:
      'Move a Maria para a etapa de fechado e trava o valor da proposta, assim ninguém altera, sem querer, um combinado que já foi fechado.',
    voceVe:
      'O valor sai de “Em negociação” e entra em “Fechado no mês”. A taxa de propostas aprovadas também se atualiza.',
  },
  {
    titulo: 'Você marca o dia do serviço',
    chamada: 'Cliente, serviço, dia e hora.',
    voceFaz: 'Agenda a instalação escolhendo a Maria, o serviço do seu catálogo, o dia e a hora.',
    sistemaFaz:
      'Mostra o compromisso na agenda e no painel. Se a hora passar e o serviço continuar sem ser feito, ele aparece como atrasado.',
    voceVe:
      'A “Agenda de hoje” lista a instalação com o horário, e os compromissos de amanhã e dos próximos 7 dias aparecem logo abaixo.',
  },
  {
    titulo: 'O serviço é feito',
    chamada: 'Um clique em “executado”, e o sistema faz o resto.',
    voceFaz: `Marca como executado, confere os materiais usados (a lista padrão do serviço já vem preenchida) e informa se os ${RECEITA} já foram recebidos ou ainda vão ser.`,
    sistemaFaz: `Tudo de uma vez, ou nada: registra o serviço no histórico da Maria, tira do estoque o material usado, calcula a comissão de quem fez (se você usa comissão) e lança os ${RECEITA} no financeiro, já ligados a esse serviço.`,
    voceVe:
      'Na ficha da Maria, o serviço aparece no histórico. No estoque, o saldo do material já baixou. No financeiro, o recebimento, ou a conta a receber, já está lançado.',
  },
  {
    titulo: 'No fim do mês, a conta já está pronta',
    chamada: 'Quanto sobrou, serviço por serviço.',
    voceFaz:
      'Lançou a despesa de combustível ligada à instalação, no dia em que pagou. Fora isso, nada: é só abrir o painel financeiro.',
    sistemaFaz:
      'Soma o que entrou com tudo o que esse serviço custou, como material do estoque, comissão e despesas ligadas a ele, e calcula a sobra de cada tipo de serviço.',
    voceVe: `A instalação deixou ${reais(CONTA.sobra)} de sobra: de cada R$ 100 recebidos, R$ ${CONTA.percentual} ficaram com você. É assim para todos os serviços, lado a lado.`,
    mostraConta: true,
  },
];

/**
 * Seis palavras que travam quem não é do ramo.
 *
 * Cada uma diz o que é e dá uma conta com número redondo. As definições são as
 * mesmas que o botão "?" do painel mostra ao lado de cada número (veja
 * `lib/glossario.ts`) — escritas de novo aqui, num tom de conversa, mas sem
 * contradizê-las. Se uma fórmula mudar no sistema, mude nos dois lugares.
 */
export interface Palavra {
  termo: string;
  significa: string;
  exemplo: string;
}

export const PALAVRAS: readonly Palavra[] = [
  {
    termo: 'Margem',
    significa: 'O que sobra de um serviço depois de pagar o que ele custou.',
    exemplo: 'Cobrou R$ 100 e gastou R$ 40? A margem é R$ 60, ou 60%.',
  },
  {
    termo: 'Fluxo de caixa',
    significa: 'O vaivém do dinheiro: quanto entrou e quanto saiu num período.',
    exemplo:
      'Entrou R$ 8.000 e saiu R$ 5.500: o saldo é R$ 2.500. Atenção: isso não é lucro, nem o saldo do banco.',
  },
  {
    termo: 'Custo fixo e variável',
    significa:
      'Fixo é o que você paga todo mês, mesmo sem vender (aluguel, internet). Variável cresce com o trabalho (material).',
    exemplo:
      'Com o fixo separado, o sistema mostra quanto o negócio custa por dia, só para existir.',
  },
  {
    termo: 'Pró-labore',
    significa: 'A retirada mensal do dono, tratada como um custo do negócio.',
    exemplo:
      'Assim o seu dinheiro não se mistura com o da empresa, e o sistema sugere um teto do quanto dá para retirar.',
  },
  {
    termo: 'A receber e a pagar',
    significa: 'Dinheiro que ainda vai entrar e contas que ainda vão sair.',
    exemplo:
      'Só viram “entrada” ou “saída” quando você dá baixa, isto é, confirma que o pagamento aconteceu.',
  },
  {
    termo: 'Conciliação',
    significa: 'Conferir se o que está no sistema bate com o extrato do banco.',
    exemplo:
      'Você envia o extrato e o sistema sugere com qual conta cada linha combina. Nada é dado como pago até você confirmar.',
  },
];

/**
 * Recursos de inteligência artificial.
 *
 * `disponivel` separa o que já existe do roadmap. A página apresenta a previsão
 * financeira como produto atual e identifica os demais recursos como próximos
 * passos, sem prometer como pronto o que ainda está em desenvolvimento.
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
      'Tire uma foto do comprovante e o lançamento aparece preenchido: valor, data e categoria. Você confere e confirma, e o trabalho vira conferir, não digitar.',
  },
  {
    icone: TrendingUp,
    titulo: 'Sugestão de preço',
    pergunta: '"Será que estou cobrando barato demais nesse serviço?"',
    descricao:
      'A partir do que você realmente gastou e recebeu em cada tipo de trabalho, o sistema aponta onde o preço não está cobrindo o custo, e quanto seria preciso cobrar para fechar a conta.',
  },
  {
    icone: Bell,
    titulo: 'Aviso do que vai esfriar',
    pergunta: '"Aquele orçamento sumiu e eu nem percebi."',
    descricao:
      'Comparando com o que costuma acontecer no seu histórico, o sistema avisa quais negociações estão perdendo força a tempo de você agir, em vez de descobrir depois que o cliente fechou com outro.',
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

/**
 * O inventário do produto, módulo a módulo.
 *
 * Os cartões de `RECURSOS` vendem a ideia; esta lista responde a pergunta
 * seguinte, que é a que trava a decisão de compra: *"mas o que exatamente vem
 * junto?"*. Por isso aqui é enumeração seca, no vocabulário de quem usa — e
 * onde o termo é técnico, vai uma explicação curta entre parênteses.
 *
 * Regra ao editar: **só entra o que existe hoje, em produção**. O que está por
 * vir tem lugar próprio, em `RECURSOS_IA` com `disponivel: false` — misturar os
 * dois transforma a página numa promessa, e a primeira semana de uso em
 * decepção.
 */
export interface Modulo {
  icone: LucideIcon;
  nome: string;
  resumo: string;
  itens: readonly string[];
}

export const MODULOS: readonly Modulo[] = [
  {
    icone: Contact,
    nome: 'Clientes',
    resumo: 'A ficha de quem você atende, com tudo que já aconteceu.',
    itens: [
      'Cadastro com telefone, documento, origem (de onde o cliente veio) e etiquetas',
      'Histórico de atendimentos por cliente',
      'Busca por nome, telefone ou documento',
      'Importação de planilha e exportação dos dados',
    ],
  },
  {
    icone: KanbanSquare,
    nome: 'Negociações',
    resumo: 'O quadro que mostra em que pé está cada conversa.',
    itens: [
      'Etapas prontas, ajustáveis à sua operação',
      'Destaque para o que está parado há 7 dias ou mais',
      'Orçamento enviado e orçamento aprovado levam o cliente de etapa sozinhos',
    ],
  },
  {
    icone: FileText,
    nome: 'Orçamentos e serviços',
    resumo: 'A proposta que você envia e o serviço que carrega o custo.',
    itens: [
      'Orçamento com valor, validade e situação (aberto, aprovado, recusado)',
      'Catálogo de serviços com preço e custo',
      'Aviso das propostas que estão perto de vencer',
    ],
  },
  {
    icone: CalendarDays,
    nome: 'Agenda e lembretes',
    resumo: 'O compromisso marcado e o retorno que não se perde.',
    itens: [
      'Agendamentos ligados ao cliente e ao serviço',
      'Um clique em “executado” registra o serviço no histórico do cliente',
      'Lembrete de retorno enviado por e-mail ao cliente, na data marcada',
    ],
  },
  {
    icone: Boxes,
    nome: 'Estoque e comissões',
    resumo: 'O material que o serviço gasta e o quanto cada pessoa ganha.',
    itens: [
      'Materiais com saldo e estoque mínimo',
      'Custo médio calculado a cada compra',
      'Material usado sai do estoque ao concluir o serviço',
      'Comissão por pessoa, com fechamento por período',
    ],
  },
  {
    icone: Wallet,
    nome: 'Financeiro',
    resumo: 'Onde o dinheiro entra, sai e finalmente faz sentido.',
    itens: [
      'Entradas e saídas, com a data do lançamento e a data em que foi pago',
      'Contas a pagar e a receber com vencimento e baixa (a confirmação de que foi pago)',
      'Categorias, custo fixo e custo variável',
      'Nota fiscal, boleto e comprovante anexados ao lançamento',
      'Reservas (dinheiro guardado para um fim) e pró-labore (retirada do dono), com histórico',
      'Conferência com o extrato do banco e importação por planilha',
    ],
  },
  {
    icone: TrendingUp,
    nome: 'Resultado',
    resumo: 'A resposta que a planilha não dava.',
    itens: [
      'Margem por tipo de serviço, já calculada',
      'Entradas, saídas e saldo de qualquer período',
      'Teto de retirada sugerido a partir do que entrou de fato',
      'Painel inicial com alertas do que pede ação, atualizado sozinho',
      'Botão “?” ao lado de cada número, explicando o que ele significa',
      'Previsão do caixa com IA, no plano Premium',
    ],
  },
  {
    icone: Users,
    nome: 'Equipe e acesso',
    resumo: 'A equipe usando o sistema sem ver o que não deve.',
    itens: [
      'Convite por e-mail com papel definido',
      'Permissão por ação, então quem atende não vê faturamento',
      'Histórico de quem alterou o quê, e quando',
    ],
  },
];

/**
 * As dúvidas que travam o cadastro.
 *
 * Duas funções: tirar o medo de quem não entende de sistema, e dizer com
 * franqueza o que o produto **não** faz. A segunda parte é de propósito. Quem
 * descobre um limite depois de assinar cancela e conta para os outros; quem
 * lê o limite aqui e assina assim mesmo é o cliente certo.
 *
 * Cada resposta foi conferida contra o código ou o README — em especial as
 * que falam de limite (WhatsApp, nota fiscal, IA).
 */
export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export const PERGUNTAS: readonly Pergunta[] = [
  {
    pergunta: 'Preciso entender de finanças ou de tecnologia?',
    resposta:
      'Não. Foi feito para quem toca o negócio, não para quem estuda finanças. Ao lado dos números importantes há um botão “?” que explica, em palavras simples, o que cada um significa e como é calculado, e o painel inicial mostra primeiro o que precisa da sua atenção hoje.',
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
    pergunta: 'Meus funcionários vão ver quanto a empresa fatura?',
    resposta:
      'Só se você deixar. Cada pessoa entra com um papel, como atendente, técnico ou financeiro, e as permissões podem ser ajustadas uma a uma. Quem atende cliente enxerga o atendimento, sem ver o dinheiro.',
  },
  {
    pergunta: 'O que a inteligência artificial faz, e o que ela não faz?',
    resposta:
      'Ela lê os números do seu negócio e explica em português: o risco do caixa, o que merece atenção, por onde começar. Ela não cadastra, não apaga, não paga conta e não manda mensagem por você, e quem decide é sempre uma pessoa. Está no plano Premium.',
  },
  {
    pergunta: 'Os lembretes vão por WhatsApp?',
    resposta:
      'Hoje o envio automático é por e-mail, para o e-mail cadastrado do cliente. O WhatsApp ainda não envia, porque depende da aprovação de uma conta pela Meta, e o sistema avisa quando um lembrete assim não pôde ser enviado.',
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
  {
    pergunta: 'Meus dados ficam seguros? E se eu quiser sair?',
    resposta:
      'Cada empresa só enxerga os próprios dados: o banco de dados recusa o acesso a qualquer outra, e há testes automáticos que tentam violar isso. A entrada exige senha e um código do celular. Se quiser sair, você exporta tudo; ao cancelar, o apagamento definitivo acontece depois de 30 dias.',
  },
];
