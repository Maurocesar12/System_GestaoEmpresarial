/**
 * Glossário dos números do painel.
 *
 * É **conteúdo**, não lógica: cada conceito explica, em linguagem de quem toca
 * o negócio, um termo que aparece nas telas. Fica num arquivo próprio porque
 * cresce por edição — quando uma fórmula muda no backend, muda-se o texto aqui,
 * e nenhum componente precisa ser tocado.
 *
 * ## O que este arquivo não faz
 *
 * Não calcula nada. A regra de negócio mora na API; aqui só está a descrição
 * dela. Por isso cada `comoCalcula` foi escrito a partir do código que de fato
 * produz o número (fluxo de caixa, margem, painel em tempo real, pró-labore,
 * estoque), e não do que "parece" a fórmula. Se uma delas mudar na API, o texto
 * correspondente precisa mudar junto — senão a ajuda passa a contradizer a tela.
 *
 * Os `exemplo` usam números redondos e inventados de propósito: servem para
 * ensinar a conta, e não podem ser confundidos com os dados da empresa.
 *
 * ## Regras de redação
 *
 * - Frase curta, sem jargão: "o que sobrou", e não "resultado operacional".
 * - O `resumo` responde "o que é isto?" em uma frase.
 * - O `comoLer` diz o que fazer com o número, ou a leitura errada mais comum.
 */
export type CategoriaConceito = 'caixa' | 'custos' | 'vendas' | 'clientes' | 'estoque';

export const CATEGORIAS: readonly { id: CategoriaConceito; rotulo: string }[] = [
  { id: 'caixa', rotulo: 'Dinheiro e caixa' },
  { id: 'custos', rotulo: 'Custos e lucro' },
  { id: 'vendas', rotulo: 'Vendas' },
  { id: 'clientes', rotulo: 'Clientes' },
  { id: 'estoque', rotulo: 'Estoque e reservas' },
];

export interface Conceito {
  titulo: string;
  categoria: CategoriaConceito;
  /** O que é, em uma frase. É o que aparece primeiro no balão. */
  resumo: string;
  /** De onde vem o número, na ordem em que o sistema faz a conta. */
  comoCalcula?: string;
  /** O que fazer com ele — ou a leitura errada mais comum. */
  comoLer?: string;
  /** Conta com números redondos e inventados. */
  exemplo?: string;
  /** Tela onde o assunto é trabalhado. */
  onde?: { rotulo: string; href: string };
  /** Outras formas de procurar o mesmo conceito, sem acento e em minúsculas. */
  busca?: readonly string[];
}

export const GLOSSARIO = {
  // --- Dinheiro e caixa ------------------------------------------------------
  entradas: {
    titulo: 'Entradas',
    categoria: 'caixa',
    resumo: 'Dinheiro que de fato entrou na empresa no período.',
    comoCalcula:
      'Soma dos lançamentos de entrada que já foram pagos dentro do período escolhido. Lançamentos pessoais ficam de fora.',
    comoLer:
      'Uma venda só vira entrada quando você dá baixa nela. Se o número parece baixo, confira o que ainda está em "A receber".',
    exemplo:
      'Você fechou um serviço de R$ 1.000 no dia 28, mas o cliente só pagou no dia 3 do mês seguinte. Os R$ 1.000 contam como entrada do mês seguinte.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['receita', 'recebido', 'faturamento', 'quanto entrou'],
  },
  saidas: {
    titulo: 'Saídas',
    categoria: 'caixa',
    resumo: 'Dinheiro que de fato saiu da empresa no período.',
    comoCalcula:
      'Soma dos lançamentos de saída que já foram pagos dentro do período escolhido. Lançamentos pessoais ficam de fora.',
    comoLer:
      'Uma conta só vira saída quando recebe baixa. O que ainda não foi pago aparece em "A pagar".',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['despesa', 'gasto', 'pago', 'quanto saiu'],
  },
  saldo: {
    titulo: 'Saldo do período',
    categoria: 'caixa',
    resumo: 'O que sobrou (ou faltou) no período: o que entrou menos o que saiu.',
    comoCalcula: 'Entradas menos saídas, ambas contadas pela data de pagamento.',
    comoLer:
      'Saldo positivo quer dizer que entrou mais do que saiu. Ele não é lucro nem o saldo do banco: é só o movimento daquele intervalo, sem impostos. Para o lucro de verdade, confirme com seu contador.',
    exemplo: 'Entraram R$ 8.000 e saíram R$ 5.500. O saldo do período é R$ 2.500.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['sobrou', 'lucro', 'fluxo de caixa', 'resultado'],
  },
  'caixa-do-mes': {
    titulo: 'Caixa do mês',
    categoria: 'caixa',
    resumo: 'O saldo do mês corrente, do dia 1º até hoje.',
    comoCalcula:
      'Entradas pagas desde o dia 1º do mês até hoje, menos as saídas pagas no mesmo intervalo. Só considera lançamentos da empresa.',
    comoLer:
      'Muda a cada baixa que você dá. No começo do mês é normal estar perto de zero: ele só conta o que já aconteceu.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['saldo do mes', 'caixa'],
  },
  'data-do-pagamento': {
    titulo: 'Data do pagamento x data do lançamento',
    categoria: 'caixa',
    resumo:
      'O sistema usa duas datas: a do lançamento (quando foi registrado) e a do pagamento (quando o dinheiro se moveu).',
    comoCalcula:
      'Entradas, saídas e saldo contam pela data de pagamento. A lista de lançamentos filtra pela data do lançamento, por isso inclui também o que ainda não foi pago.',
    comoLer:
      'Se a lista mostra um serviço de R$ 5.000 e as entradas estão em R$ 0, não é erro: o dinheiro ainda não foi recebido. Falta dar baixa.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['baixa', 'dar baixa', 'competencia', 'saldo nao bate', 'por que nao aparece'],
  },
  'a-receber': {
    titulo: 'A receber',
    categoria: 'caixa',
    resumo: 'Dinheiro que clientes ainda vão pagar.',
    comoCalcula:
      'Soma das entradas da empresa que ainda não têm pagamento registrado, qualquer que seja o vencimento.',
    comoLer:
      'Quando o dinheiro chegar, dê baixa: é isso que move o valor para as "Entradas" do período.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['contas a receber', 'fiado', 'cobrar'],
  },
  'a-pagar': {
    titulo: 'A pagar',
    categoria: 'caixa',
    resumo: 'Contas que a empresa ainda vai pagar.',
    comoCalcula:
      'Soma das saídas da empresa que ainda não têm pagamento registrado, qualquer que seja o vencimento.',
    comoLer:
      'Ao pagar, dê baixa: o valor sai de "A pagar" e passa a contar nas "Saídas" do período.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['contas a pagar', 'boleto', 'divida'],
  },
  vencido: {
    titulo: 'Vencido',
    categoria: 'caixa',
    resumo: 'Conta em aberto cuja data de vencimento já passou.',
    comoCalcula:
      'Lançamento da empresa, sem pagamento registrado, com vencimento anterior a hoje. Vale para entradas ("vencido a receber") e para saídas ("vencido a pagar").',
    comoLer:
      'Vencido a receber pede cobrança. Vencido a pagar pede atenção para evitar multa e juros. Se já foi pago e ficou assim, falta dar baixa.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['atrasado', 'atraso', 'inadimplencia', 'inadimplente'],
  },
  conciliacao: {
    titulo: 'Conciliação',
    categoria: 'caixa',
    resumo: 'Conferir se o que está no sistema bate com o extrato do banco.',
    comoCalcula:
      'Você importa o extrato; o sistema sugere com qual conta em aberto cada linha combina e aponta o que ficou pendente ou diferente. Nada é gravado até você confirmar.',
    comoLer:
      'Conciliar uma linha é dar baixa na conta escolhida. A regra é sempre a mesma: só dê baixa depois de confirmar que o dinheiro realmente entrou ou saiu.',
    onde: { rotulo: 'Financeiro > Conciliação', href: '/painel/financeiro/conciliacao' },
    busca: ['extrato', 'banco', 'ofx', 'bater com o banco', 'importar extrato'],
  },

  // --- Custos e lucro --------------------------------------------------------
  'custo-fixo': {
    titulo: 'Custo fixo',
    categoria: 'custos',
    resumo: 'Gasto que existe todo mês, mesmo sem vender nada — como aluguel e internet.',
    comoCalcula: 'Soma das saídas pagas no período cuja categoria foi marcada como custo fixo.',
    comoLer:
      'A classificação vem da categoria. Se o número não reflete a sua realidade, ajuste o tipo de custo da categoria.',
    onde: { rotulo: 'Financeiro > Categorias', href: '/painel/financeiro/categorias' },
    busca: ['aluguel', 'despesa fixa', 'estrutura'],
  },
  'custo-variavel': {
    titulo: 'Custo variável',
    categoria: 'custos',
    resumo: 'Gasto que cresce ou diminui conforme o volume de trabalho — como material.',
    comoCalcula: 'Soma das saídas pagas no período cuja categoria foi marcada como custo variável.',
    comoLer:
      'Quanto mais você vende, mais ele tende a subir. Por isso ele é comparado com a receita, e não com o calendário.',
    onde: { rotulo: 'Financeiro > Categorias', href: '/painel/financeiro/categorias' },
    busca: ['material', 'despesa variavel'],
  },
  'sem-categoria': {
    titulo: 'Saídas sem categoria',
    categoria: 'custos',
    resumo: 'Saídas que ainda não foram classificadas como custo fixo ou variável.',
    comoCalcula:
      'Total das saídas menos o custo fixo e o variável. O sistema não adivinha: enquanto a categoria não é definida, o valor fica separado.',
    comoLer:
      'Um valor grande aqui é o recado de que falta classificar. Até lá, o custo fixo e o custo por dia podem ficar menores do que a realidade.',
    onde: { rotulo: 'Financeiro > Categorias', href: '/painel/financeiro/categorias' },
    busca: ['nao classificado', 'classificar', 'sem classificacao'],
  },
  'custo-por-dia': {
    titulo: 'Custo por dia',
    categoria: 'custos',
    resumo: 'Quanto o negócio custa, por dia, só para existir.',
    comoCalcula:
      'Custo fixo do período dividido pelos dias do período, mais o pró-labore mensal dividido por 30.',
    comoLer:
      'É um ponto de partida para precificar: cada dia de trabalho precisa render ao menos isso para cobrir a estrutura. Sem pró-labore registrado, o número considera só o custo fixo.',
    exemplo:
      'Custo fixo de R$ 6.000 num mês de 30 dias dá R$ 200 por dia. Com pró-labore de R$ 3.000 (R$ 100 por dia), o custo por dia é R$ 300.',
    onde: { rotulo: 'Financeiro > Pró-labore', href: '/painel/financeiro/pro-labore' },
    busca: ['custo operacional', 'custo diario', 'quanto custa por dia'],
  },
  margem: {
    titulo: 'Margem',
    categoria: 'custos',
    resumo: 'O que sobra de cada serviço depois de descontar o que ele custou.',
    comoCalcula:
      'Receita do serviço menos o custo dele: as saídas ligadas ao serviço, os materiais usados do estoque e as comissões.',
    comoLer:
      'Compare os serviços entre si. Só funciona bem se as entradas e saídas estiverem vinculadas a um serviço — o que fica sem vínculo é avisado abaixo da tabela.',
    exemplo:
      'Receita de R$ 1.000. Custos: R$ 300 em lançamentos, R$ 100 em materiais e R$ 100 em comissões, ou seja, R$ 500. A margem é R$ 500.',
    onde: { rotulo: 'Financeiro > Movimento', href: '/painel/financeiro' },
    busca: ['lucro por servico', 'rentabilidade', 'qual servico da lucro'],
  },
  'margem-percentual': {
    titulo: 'Margem em %',
    categoria: 'custos',
    resumo: 'De cada R$ 100 que entram com o serviço, quanto sobra como margem.',
    comoCalcula:
      'Margem dividida pela receita, vezes 100. Sem receita no período a conta não existe, e o sistema mostra um traço (—) em vez de 0%.',
    comoLer:
      'Abaixo de 20% a margem merece atenção (amarelo); abaixo de zero o serviço está dando prejuízo (vermelho). O valor em reais mostra o tamanho; o percentual mostra a eficiência.',
    exemplo:
      'Margem de R$ 500 sobre R$ 1.000 de receita é 50%: de cada R$ 100 que entram, R$ 50 ficam.',
    busca: ['percentual', 'porcentagem', 'margem de lucro'],
  },
  'pro-labore': {
    titulo: 'Pró-labore',
    categoria: 'custos',
    resumo: 'A retirada mensal do dono, tratada como um custo do negócio.',
    comoCalcula:
      'O valor tem vigência (início e fim): registrar um novo não apaga os antigos. O valor vigente entra no custo por dia.',
    comoLer:
      'Separar a sua retirada das despesas da empresa é o que revela se o negócio se sustenta sozinho.',
    onde: { rotulo: 'Financeiro > Pró-labore', href: '/painel/financeiro/pro-labore' },
    busca: ['prolabore', 'retirada', 'salario do dono', 'quanto posso tirar'],
  },
  'teto-pro-labore': {
    titulo: 'Teto sugerido',
    categoria: 'custos',
    resumo: 'O máximo que o sistema considera seguro você retirar por mês.',
    comoCalcula:
      'Receita média mensal dos meses fechados da janela escolhida, menos o custo fixo médio, menos o custo variável médio, menos um aporte sugerido para as reservas (o que falta para as metas, diluído em 12 meses). Nunca fica abaixo de zero.',
    comoLer:
      'É uma referência, não uma regra. Empresa nova usa só os meses em que teve movimento, para não diluir a média.',
    onde: { rotulo: 'Financeiro > Pró-labore', href: '/painel/financeiro/pro-labore' },
    busca: ['quanto posso retirar', 'limite de retirada', 'teto'],
  },
  folga: {
    titulo: 'Folga',
    categoria: 'custos',
    resumo: 'Quanto ainda dá para aumentar a retirada sem passar do teto sugerido.',
    comoCalcula: 'Teto sugerido menos o pró-labore atual.',
    comoLer:
      'Negativa significa que a retirada atual está acima do teto: o negócio está pagando mais ao dono do que a média recente sustenta.',
    onde: { rotulo: 'Financeiro > Pró-labore', href: '/painel/financeiro/pro-labore' },
    busca: ['acima do teto', 'sobra'],
  },

  // --- Vendas ----------------------------------------------------------------
  'em-negociacao': {
    titulo: 'Em negociação',
    categoria: 'vendas',
    resumo: 'Propostas enviadas que ainda aguardam resposta do cliente.',
    comoCalcula: 'Soma e quantidade dos orçamentos com status "aberto".',
    comoLer:
      'É dinheiro possível, ainda não é dinheiro garantido. Quanto mais tempo uma proposta fica aberta, menor costuma ser a chance de fechar.',
    onde: { rotulo: 'Orçamentos em aberto', href: '/painel/orcamentos?status=aberto' },
    busca: ['propostas abertas', 'pipeline', 'orcamentos abertos'],
  },
  'fechado-no-mes': {
    titulo: 'Fechado no mês',
    categoria: 'vendas',
    resumo: 'Valor das propostas que os clientes aprovaram neste mês.',
    comoCalcula:
      'Soma dos orçamentos aprovados cuja resposta foi registrada desde o dia 1º do mês.',
    comoLer:
      'Abaixo do valor aparecem dois números de apoio: a taxa de conversão (das propostas respondidas no mês, quantas foram aprovadas) e o ticket médio (o valor médio de uma venda fechada). Venda fechada ainda não é dinheiro no caixa: ele só entra quando você dá baixa no pagamento.',
    onde: { rotulo: 'Orçamentos aprovados', href: '/painel/orcamentos?status=aprovado' },
    busca: ['vendas do mes', 'aprovados', 'faturado'],
  },
  'taxa-de-conversao': {
    titulo: 'Taxa de conversão',
    categoria: 'vendas',
    resumo: 'De cada 100 propostas respondidas no mês, quantas o cliente aprovou.',
    comoCalcula:
      'Propostas aprovadas dividido por (aprovadas + recusadas), contando só as respondidas desde o dia 1º do mês. As que seguem em aberto não entram — assim a taxa não despenca só porque você emitiu mais propostas.',
    comoLer:
      'Taxa baixa com muitas propostas pode indicar preço ou proposta mal explicada. Sem nenhuma proposta respondida no mês, a taxa fica em 0%.',
    exemplo:
      'Em um mês: 6 aprovadas, 4 recusadas e 5 ainda em aberto. A taxa é 6 ÷ 10 = 60%. As 5 em aberto ficam fora da conta.',
    onde: { rotulo: 'Orçamentos', href: '/painel/orcamentos' },
    busca: ['conversao', 'taxa de fechamento', 'quantos fecham'],
  },
  'ticket-medio': {
    titulo: 'Ticket médio',
    categoria: 'vendas',
    resumo: 'O valor médio de uma venda fechada.',
    comoCalcula: 'Média do valor de todas as propostas já aprovadas.',
    comoLer:
      'Aumentar o ticket médio faz o faturamento crescer sem precisar de mais clientes: serviços complementares e pacotes costumam ajudar.',
    exemplo: 'Três propostas aprovadas: R$ 800, R$ 1.000 e R$ 1.200. O ticket médio é R$ 1.000.',
    onde: { rotulo: 'Orçamentos', href: '/painel/orcamentos' },
    busca: ['valor medio', 'media por venda'],
  },
  'proposta-vencendo': {
    titulo: 'Propostas vencendo',
    categoria: 'vendas',
    resumo: 'Propostas em aberto cuja validade está acabando — ou já acabou.',
    comoCalcula:
      'Orçamentos abertos com data de validade nos próximos 7 dias. As que já passaram da validade continuam na lista, marcadas como vencidas.',
    comoLer:
      'Proposta vencida pode ter o preço desatualizado. Vale falar com o cliente antes: renovar a validade ou encerrar.',
    onde: { rotulo: 'Orçamentos em aberto', href: '/painel/orcamentos?status=aberto' },
    busca: ['validade', 'prazo da proposta', 'vencimento da proposta'],
  },
  funil: {
    titulo: 'Funil de vendas',
    categoria: 'vendas',
    resumo: 'O caminho que o cliente percorre, do primeiro contato ao fechamento.',
    comoCalcula:
      'Cada etapa é uma coluna e cada cliente está em uma delas. O número ao lado da etapa é a quantidade de clientes; o valor soma o que está em jogo ali.',
    comoLer:
      'O que interessa é onde o dinheiro está travado: muita gente numa etapa e pouca na seguinte mostra onde a venda emperra.',
    onde: { rotulo: 'Relacionamento > Funil', href: '/painel/funil' },
    busca: ['kanban', 'etapas', 'pipeline', 'quadro'],
  },
  'negociacao-parada': {
    titulo: 'Negociação parada',
    categoria: 'vendas',
    resumo: 'Cliente que está há tempo demais na mesma etapa do funil.',
    comoCalcula: 'Clientes parados na mesma etapa há 7 dias ou mais.',
    comoLer:
      'Parado não é perdido: um contato rápido costuma destravar. Registrar o atendimento ou mover o cartão tira o cliente desta lista.',
    onde: { rotulo: 'Relacionamento > Funil', href: '/painel/funil' },
    busca: ['parado', 'estagnado', 'sem andamento'],
  },

  // --- Clientes --------------------------------------------------------------
  lead: {
    titulo: 'Lead',
    categoria: 'clientes',
    resumo: 'Contato novo que chegou até você e ainda está sendo atendido.',
    comoCalcula:
      'Todo cliente cadastrado nos últimos 30 dias. A situação (aguardando contato, em contato, proposta enviada, fechado) é calculada pelo sistema.',
    comoLer:
      'Quem espera contato há mais de 24 horas aparece destacado: lead respondido rápido tem muito mais chance de virar venda. Preencher a origem mostra quais canais trazem gente.',
    onde: { rotulo: 'Início', href: '/painel#leads' },
    busca: ['leads', 'novos contatos', 'quem chegou', 'aguardando contato'],
  },
  reativacao: {
    titulo: 'Reativação',
    categoria: 'clientes',
    resumo: 'Clientes que esfriaram e vale a pena chamar de volta.',
    comoCalcula:
      'Clientes sem contato há mais de 60 dias e sem nada em aberto, ordenados por quanto já gastaram com você. Cada linha diz o motivo: comprou e sumiu, recusou a proposta ou nunca fechou.',
    comoLer:
      'Quem já comprou costuma ser o contato mais barato de vender de novo. Registrar um atendimento ou marcar um retorno tira o cliente da lista.',
    onde: { rotulo: 'Início', href: '/painel#reativacao' },
    busca: ['cliente frio', 'clientes parados', 'sumiu', 'retomar', 'inativo'],
  },

  // --- Estoque e reservas ----------------------------------------------------
  'custo-medio': {
    titulo: 'Custo médio',
    categoria: 'estoque',
    resumo: 'O preço médio que você pagou por unidade do material, considerando todas as compras.',
    comoCalcula:
      'A cada compra: (saldo atual × custo atual + quantidade comprada × preço pago) ÷ nova quantidade total. Com o saldo zerado ou negativo, o custo passa a ser o da compra.',
    comoLer:
      'É o custo usado quando o material é consumido num serviço — por isso ele entra na margem.',
    exemplo:
      'Você tinha 10 unidades a R$ 5 e comprou mais 10 a R$ 7. O custo médio passa a ser R$ 6.',
    onde: { rotulo: 'Operação > Estoque', href: '/painel/estoque' },
    busca: ['custo ponderado', 'preco medio', 'custo do material'],
  },
  'valor-em-estoque': {
    titulo: 'Valor em estoque',
    categoria: 'estoque',
    resumo: 'Quanto dinheiro está parado em material.',
    comoCalcula:
      'Saldo de cada material ativo multiplicado pelo seu custo médio, somados. Saldo negativo conta como zero: não existe material "devendo" no estoque.',
    comoLer:
      'É o que você pagou, e não o que conseguiria vender. Valor alto com pouco giro é dinheiro que poderia estar no caixa.',
    onde: { rotulo: 'Operação > Estoque', href: '/painel/estoque' },
    busca: ['capital parado', 'estoque parado'],
  },
  'para-repor': {
    titulo: 'Para repor',
    categoria: 'estoque',
    resumo: 'Materiais que chegaram ao estoque mínimo e já pedem compra.',
    comoCalcula:
      'Materiais com um estoque mínimo definido cujo saldo é igual ou menor que esse mínimo.',
    comoLer:
      'Defina o mínimo de cada material com folga para o tempo de entrega do fornecedor; assim o aviso chega antes de faltar.',
    onde: { rotulo: 'Operação > Estoque', href: '/painel/estoque' },
    busca: ['estoque minimo', 'acabando', 'comprar'],
  },
  reserva: {
    titulo: 'Reserva financeira',
    categoria: 'estoque',
    resumo: 'Dinheiro separado para um fim — impostos, 13º, equipamento, emergência.',
    comoCalcula:
      'Cada reserva tem um valor guardado e, se você quiser, uma meta. Aportes e resgates ficam registrados no histórico.',
    comoLer:
      'Guardar o dinheiro que já tem destino, separado do caixa livre, evita susto no mês do vencimento.',
    onde: { rotulo: 'Financeiro > Reservas', href: '/painel/financeiro/reservas' },
    busca: ['fundo', 'guardar dinheiro', 'emergencia', 'aporte', 'resgate', 'meta'],
  },
  cobertura: {
    titulo: 'Cobertura da reserva',
    categoria: 'estoque',
    resumo:
      'Por quantos meses o dinheiro guardado pagaria o custo fixo se a empresa parasse de faturar.',
    comoCalcula:
      'Total guardado nas reservas dividido pelo custo fixo mensal, que é a média dos últimos 3 meses fechados. Sem custo fixo registrado, não há como calcular.',
    comoLer: 'A tela considera 3 meses ou mais um patamar confortável; abaixo disso, ela avisa.',
    exemplo: 'R$ 18.000 guardados e custo fixo de R$ 6.000 por mês dão 3 meses de cobertura.',
    onde: { rotulo: 'Financeiro > Reservas', href: '/painel/financeiro/reservas' },
    busca: ['quanto tempo aguento', 'meses de cobertura', 'fundo de emergencia'],
  },
} as const satisfies Record<string, Conceito>;

export type IdConceito = keyof typeof GLOSSARIO;

/** Remove acento e caixa: quem busca digita "pro labore" e espera achar "Pró-labore". */
export function normalizarParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
