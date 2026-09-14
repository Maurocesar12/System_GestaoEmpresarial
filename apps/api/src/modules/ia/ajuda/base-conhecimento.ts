/**
 * Base de conhecimento do chat de ajuda.
 *
 * É **conteúdo**, não código: cada tópico responde uma dúvida de uso do sistema
 * com o texto que uma pessoa do suporte escreveria. Fica em arquivo próprio
 * porque cresce por edição — quando uma tela muda, muda-se o tópico dela, e não
 * a lógica que casa perguntas com respostas.
 *
 * ## Regras que os tópicos seguem
 *
 * - **Só fala do sistema.** Nenhuma resposta consulta dados da empresa. É o que
 *   permite responder na hora, de graça, e sem depender das permissões de quem
 *   pergunta.
 * - **Diz onde fica.** Toda resposta termina apontando a tela, porque a dúvida
 *   real quase sempre é "onde eu clico".
 * - **Explica o porquê quando o porquê importa.** "O saldo do mês não é o saldo
 *   do banco" evita uma dúvida que voltaria em outra forma na semana seguinte.
 * - **Não promete o que não existe.** WhatsApp ainda não envia; a resposta diz
 *   isso em vez de deixar a pessoa esperando uma mensagem que não vai sair.
 */
export interface TopicoAjuda {
  id: string;
  titulo: string;
  /** Tela que resolve o assunto. */
  href: string;
  /**
   * Termos que levam até aqui — sempre minúsculos e sem acento, no formato em
   * que a pergunta chega depois de normalizada. Vale incluir o jeito errado de
   * escrever: quem tem pressa digita "orcamento" e "pro labore".
   */
  termos: string[];
  resposta: string;
  relacionados?: string[];
}

export const BASE_DE_CONHECIMENTO: readonly TopicoAjuda[] = [
  // --- Primeiros passos ----------------------------------------------------
  {
    id: 'comecar',
    titulo: 'Por onde começar',
    href: '/painel',
    termos: [
      'comecar',
      'primeiros passos',
      'primeiro acesso',
      'configurar',
      'inicio',
      'nao sei usar',
      'tutorial',
      'como usar o sistema',
      'passo a passo',
    ],
    resposta:
      'A ordem que funciona é esta:\n\n' +
      '1. **Serviços** — cadastre o que você vende, com o custo de cada um. Sem o custo, o sistema não consegue calcular sua margem depois.\n' +
      '2. **Clientes** — nome e telefone já bastam. Se você já tem uma lista, use "Importar planilha".\n' +
      '3. **Orçamento** — ao emitir a proposta, o cliente anda no funil sozinho.\n' +
      '4. **Financeiro** — registre entradas e saídas e dê baixa quando o dinheiro se mover.\n\n' +
      'Depois disso o Painel começa a fazer sentido: ele mostra o que chegou, o que está parado e o que vence.',
    relacionados: ['painel', 'servicos', 'clientes-cadastro'],
  },
  {
    id: 'painel',
    titulo: 'O painel inicial',
    href: '/painel',
    termos: [
      'painel',
      'dashboard',
      'tela inicial',
      'inicio',
      'indicadores',
      'alertas',
      'tempo real',
      'atualiza sozinho',
      'o que significa',
    ],
    resposta:
      'O painel responde três perguntas, nesta ordem: **quanto está em jogo**, **o que está parado** e **o que fazer agora**.\n\n' +
      'No topo ficam os alertas — leads sem contato, contas vencidas, compromissos atrasados — e os indicadores. Logo abaixo vêm os dois cartões que abrem o dia: **Leads que chegaram** e **Clientes para reativar**. Depois, funil, agenda, follow-ups, propostas vencendo, caixa e o que acabou de acontecer.\n\n' +
      'A tela se atualiza sozinha a cada 30 segundos e mostra o horário da última leitura. Você pode pausar a atualização automática se estiver lendo com calma, e forçar uma atualização na hora pelo botão ao lado do relógio.\n\n' +
      'Cada pessoa vê só os blocos que a permissão dela alcança: quem não tem acesso ao financeiro não recebe os números de caixa.',
    relacionados: ['leads', 'reativacao', 'permissoes'],
  },

  // --- Clientes e leads ----------------------------------------------------
  {
    id: 'clientes-cadastro',
    titulo: 'Cadastrar e editar clientes',
    href: '/painel/clientes/novo',
    termos: [
      'cliente',
      'clientes',
      'cadastrar cliente',
      'novo cliente',
      'editar cliente',
      'excluir cliente',
      'carteira',
      'contato',
      'telefone',
      'cpf',
      'cnpj',
      'documento',
    ],
    resposta:
      'Em **Clientes > Novo cliente**. Só o nome é obrigatório; telefone, e-mail, CPF/CNPJ e observações são opcionais.\n\n' +
      'Telefone e documento podem ser digitados com ou sem máscara — o sistema guarda só os dígitos e formata na exibição.\n\n' +
      'Todo cliente novo entra automaticamente na primeira etapa do funil: o cadastro é o começo da relação comercial.\n\n' +
      'A busca da listagem procura por nome, e-mail e telefone ao mesmo tempo, então serve tanto para quem lembra o nome quanto para quem só tem o número que ligou.',
    relacionados: ['clientes-importar', 'funil', 'campos-personalizados'],
  },
  {
    id: 'clientes-importar',
    titulo: 'Importar clientes de uma planilha',
    href: '/painel/clientes/importar',
    termos: [
      'importar',
      'importacao',
      'planilha',
      'excel',
      'csv',
      'migrar',
      'trazer clientes',
      'em massa',
      'lote',
    ],
    resposta:
      'Em **Clientes > Importar planilha**. Você sobe o arquivo, confere o de-para das colunas e confirma.\n\n' +
      'A tela quebra a planilha em lotes, então arquivos grandes funcionam. Linhas repetidas são **puladas**, não descartam a importação inteira, e cada linha ignorada volta com o motivo: CPF/CNPJ repetido, e-mail repetido ou repetição dentro do próprio arquivo.\n\n' +
      'Clientes sem documento e sem e-mail nunca são tratados como repetidos — dois homônimos são duas pessoas.\n\n' +
      'Se o total ultrapassar o limite de clientes do seu plano, nada é importado, e a mensagem diz quantas vagas restam.',
    relacionados: ['clientes-cadastro', 'plano'],
  },
  {
    id: 'leads',
    titulo: 'Leads que chegaram',
    href: '/painel#leads',
    termos: [
      'lead',
      'leads',
      'chegaram',
      'entrada de leads',
      'novos contatos',
      'quem chegou',
      'aguardando contato',
      'sem contato',
      'origem',
      'utm',
      'campanha',
      'de onde veio',
    ],
    resposta:
      'No **Início**, no cartão "Leads que chegaram" — não é uma tela à parte. É a fila de entrada: todo cliente cadastrado nos últimos 30 dias aparece ali, do mais recente para o mais antigo.\n\n' +
      'A situação de cada lead é calculada sozinha, ninguém precisa marcar nada:\n\n' +
      '• **Aguardando contato** — ninguém registrou atendimento, agendou nem enviou proposta.\n' +
      '• **Em contato** — já houve atendimento ou visita marcada.\n' +
      '• **Proposta enviada** — existe orçamento em aberto.\n' +
      '• **Fechado** — existe orçamento aprovado.\n\n' +
      'Quem está aguardando há mais de 24 horas aparece destacado e vira alerta no topo do painel. Cada linha traz o atalho de WhatsApp e de ligação, para falar com a pessoa sem abrir a ficha.\n\n' +
      'Preencha o campo **Origem** no cadastro do cliente para saber de onde vêm seus leads.',
    relacionados: ['reativacao', 'clientes-cadastro', 'funil'],
  },
  {
    id: 'reativacao',
    titulo: 'Lista de reativação',
    href: '/painel#reativacao',
    termos: [
      'reativacao',
      'reativar',
      'cliente frio',
      'clientes parados',
      'sumiu',
      'esfriou',
      'nao compra',
      'antigos',
      'retomar',
      'recuperar cliente',
      'inativo',
    ],
    resposta:
      'No **Início**, no cartão "Clientes para reativar". Ele lista quem está há mais de 60 dias sem nenhum contato e não tem proposta aberta nem retorno já marcado.\n\n' +
      'A fila vem ordenada por quanto o cliente já gastou com você, porque é essa a ligação que costuma valer mais. Cada linha traz o motivo, que muda a conversa:\n\n' +
      '• **Comprou e sumiu** — ofereça a revisão ou o próximo serviço.\n' +
      '• **Recusou a proposta** — uma condição nova costuma reabrir o assunto.\n' +
      '• **Proposta sem resposta** — pergunte o que faltou antes de reenviar.\n' +
      '• **Nunca fechou** — confirme se a necessidade ainda existe.\n\n' +
      'Os atalhos da linha resolvem os dois gestos possíveis: falar agora, pelo WhatsApp ou telefone, ou agendar o retorno. Assim que você registra um atendimento ou marca um follow-up, o cliente sai da lista sozinho.',
    relacionados: ['leads', 'lembretes', 'atendimentos'],
  },
  {
    id: 'atendimentos',
    titulo: 'Histórico de atendimento do cliente',
    href: '/painel/clientes',
    termos: [
      'atendimento',
      'atendimentos',
      'historico do cliente',
      'registrar contato',
      'anotacao',
      'ligacao',
      'conversa',
      'o que foi falado',
    ],
    resposta:
      'Abra a ficha do cliente em **Clientes** e use o bloco de atendimentos. Cada registro tem data e descrição.\n\n' +
      'Registrar o contato serve para três coisas além da memória: tira o lead da fila de "aguardando contato", tira o cliente da lista de reativação e deixa o histórico disponível para quem atender da próxima vez.',
    relacionados: ['leads', 'reativacao', 'clientes-cadastro'],
  },
  {
    id: 'campos-personalizados',
    titulo: 'Campos personalizados e etiquetas',
    href: '/painel/configuracoes',
    termos: [
      'campo personalizado',
      'campos personalizados',
      'etiqueta',
      'etiquetas',
      'tag',
      'marcador',
      'campo proprio',
      'campo obrigatorio',
    ],
    resposta:
      'Em **Configurações**. Campos personalizados criam informações que só a sua empresa precisa (texto, número, data ou lista de opções) e podem ser marcados como obrigatórios — a partir daí, nenhum cliente é salvo sem eles.\n\n' +
      'Etiquetas são marcadores coloridos para separar clientes por prioridade, tipo ou o que fizer sentido. Elas aparecem nos cartões do funil, o que ajuda a bater o olho e entender o quadro.',
    relacionados: ['clientes-cadastro', 'funil'],
  },

  // --- Funil ---------------------------------------------------------------
  {
    id: 'funil',
    titulo: 'Funil de vendas',
    href: '/painel/funil',
    termos: [
      'funil',
      'kanban',
      'quadro',
      'etapa',
      'etapas',
      'card',
      'cartao',
      'mover cliente',
      'arrastar',
      'pipeline',
      'negociacao',
    ],
    resposta:
      'Em **Relacionamento > Funil**. Cada coluna é uma etapa e cada cartão é um cliente, com a proposta em aberto e há quantos dias está parado ali.\n\n' +
      'A movimentação é livre: dá para ir para frente, para trás e pular etapas — é assim que a venda acontece na vida real, e um funil que recusa movimento vira um funil que ninguém atualiza.\n\n' +
      'Cliente parado há mais de 7 dias na mesma etapa aparece destacado e entra nos alertas do painel. Clientes que ainda não estão em nenhuma etapa aparecem como "fora do funil" e podem ser puxados para o quadro.',
    relacionados: ['funil-etapas', 'orcamentos', 'leads'],
  },
  {
    id: 'funil-etapas',
    titulo: 'Configurar etapas do funil',
    href: '/painel/funil/etapas',
    termos: [
      'etapas do funil',
      'criar etapa',
      'renomear etapa',
      'excluir etapa',
      'ordem das etapas',
      'marco',
      'automacao do funil',
      'configurar funil',
    ],
    resposta:
      'Em **Funil > Etapas** (só administradores). Dá para criar, renomear, reordenar e excluir etapas.\n\n' +
      'Cada etapa pode receber um **marco**, que é o que liga a automação:\n\n' +
      '• Etapa marcada como *orçamento enviado* — o cliente vai para lá sozinho quando você emite uma proposta.\n' +
      '• Etapa marcada como *fechado* — o cliente vai para lá quando a proposta é aprovada.\n\n' +
      'A automação segue o marco, e não o nome: renomear "Proposta" para "Orçamento enviado" não quebra nada. Recusar uma proposta não move ninguém de propósito — a negociação pode continuar.',
    relacionados: ['funil', 'orcamentos'],
  },

  // --- Orçamentos, agenda e serviços ---------------------------------------
  {
    id: 'orcamentos',
    titulo: 'Orçamentos e propostas',
    href: '/painel/orcamentos',
    termos: [
      'orcamento',
      'orcamentos',
      'proposta',
      'propostas',
      'aprovar',
      'recusar',
      'reabrir',
      'validade',
      'valido ate',
      'emitir',
      'venda',
    ],
    resposta:
      'Em **Operação > Orçamentos**. Cada proposta tem cliente, serviço, valor, descrição e uma validade opcional.\n\n' +
      'Os estados são três: **aberto**, **aprovado** e **recusado**. De aberto você aprova ou recusa; de aprovado ou recusado, dá para reabrir se a conversa voltar.\n\n' +
      'Emitir a proposta move o cliente para a etapa de orçamento enviado; aprovar move para a etapa de fechado. Um orçamento só pode ser editado enquanto está aberto — mudar o valor de algo já aprovado seria alterar um compromisso fechado.\n\n' +
      'Propostas com validade perto do fim aparecem no painel, em "vencendo".',
    relacionados: ['funil-etapas', 'servicos', 'financeiro-lancamentos'],
  },
  {
    id: 'agenda',
    titulo: 'Agenda e compromissos',
    href: '/painel/agenda',
    termos: [
      'agenda',
      'agendamento',
      'agendamentos',
      'compromisso',
      'marcar',
      'visita',
      'confirmar',
      'cancelar',
      'executado',
      'reagendar',
      'horario',
    ],
    resposta:
      'Em **Operação > Agenda**. Um compromisso liga cliente, serviço, data e hora.\n\n' +
      'O ciclo é: **agendado** → confirmar, executar ou cancelar. De **confirmado**, dá para executar, cancelar ou reagendar (quando o cliente desmarca). **Cancelado** pode ser reagendado. **Executado** é definitivo — desfazer apagaria um fato.\n\n' +
      'Compromissos que passaram da hora e continuam agendados ou confirmados aparecem como atrasados no painel. Marcar como executado é o gesto que fecha a operação e prepara o lançamento financeiro do serviço.',
    relacionados: ['servicos', 'financeiro-lancamentos', 'painel'],
  },
  {
    id: 'servicos',
    titulo: 'Catálogo de serviços',
    href: '/painel/servicos',
    termos: [
      'servico',
      'servicos',
      'catalogo',
      'custo base',
      'preco padrao',
      'preco',
      'margem',
      'quanto cobrar',
      'desativar servico',
    ],
    resposta:
      'Em **Operação > Serviços**. Cada serviço tem nome, categoria opcional, **custo base** e **preço padrão**.\n\n' +
      'O custo base é o que sai do seu bolso para entregar aquele serviço. É ele que permite ao relatório de margem responder qual serviço realmente dá lucro — sem custo preenchido, o relatório não tem o que comparar.\n\n' +
      'Serviços que saíram de linha podem ser desativados em vez de excluídos: assim eles somem das listas novas e continuam nos orçamentos e relatórios antigos.',
    relacionados: ['financeiro-margem', 'orcamentos'],
  },
  {
    id: 'lembretes',
    titulo: 'Lembretes e follow-up',
    href: '/painel/lembretes',
    termos: [
      'lembrete',
      'lembretes',
      'follow up',
      'followup',
      'retorno',
      'nao enviou',
      'email nao chegou',
      'whatsapp',
      'cobranca de retorno',
      'agendar retorno',
    ],
    resposta:
      'Em **Relacionamento > Lembretes**. Você escolhe o cliente, o canal e a data de envio.\n\n' +
      'Os lembretes por **e-mail** saem sozinhos: uma varredura periódica pega os que venceram e enfileira o envio. Cada lembrete fica como pendente, enviado, falhou ou cancelado, e quando falha o motivo fica registrado — normalmente e-mail inválido.\n\n' +
      'O canal **WhatsApp** ainda não envia. Ele depende de aprovação da conta na Meta; até lá, esses lembretes são marcados como falhos com o motivo explícito, em vez de ficarem esperando para sempre.\n\n' +
      'Lembrete pendente com data no passado aparece como atrasado no painel.',
    relacionados: ['reativacao', 'painel'],
  },

  // --- Financeiro ----------------------------------------------------------
  {
    id: 'financeiro-lancamentos',
    titulo: 'Lançamentos: entradas e saídas',
    href: '/painel/financeiro',
    termos: [
      'financeiro',
      'lancamento',
      'lancamentos',
      'entrada',
      'saida',
      'despesa',
      'receita',
      'pagar',
      'receber',
      'baixa',
      'dar baixa',
      'vencimento',
      'conta',
      'pessoal',
      'empresa',
    ],
    resposta:
      'Em **Financeiro > Movimento**. Cada lançamento tem tipo (entrada ou saída), valor, data de competência, vencimento opcional, categoria e natureza.\n\n' +
      '**Natureza** separa o que é da empresa do que é pessoal. Os relatórios de caixa e margem usam só o que é da empresa — misturar os dois distorce o custo e, na sequência, toda decisão de preço.\n\n' +
      '**Dar baixa** é o que marca o dia em que o dinheiro se moveu de verdade. Enquanto não há baixa, o lançamento é uma conta a pagar ou a receber. É por isso que o fluxo de caixa soma pela data de pagamento, e não pela data do lançamento.\n\n' +
      'Deu baixa por engano? Existe estorno da baixa, que devolve o lançamento para em aberto.',
    relacionados: ['financeiro-categorias', 'financeiro-fluxo', 'financeiro-conciliacao'],
  },
  {
    id: 'financeiro-categorias',
    titulo: 'Categorias e tipo de custo',
    href: '/painel/financeiro/categorias',
    termos: [
      'categoria',
      'categorias',
      'custo fixo',
      'custo variavel',
      'tipo de custo',
      'classificar',
      'plano de contas',
    ],
    resposta:
      'Em **Financeiro > Categorias**. Além do nome, cada categoria de saída tem um **tipo de custo**: fixo (existe mesmo num mês sem venda, como aluguel) ou variável (cresce com o volume, como material).\n\n' +
      'Essa classificação é o que permite ao fluxo de caixa separar custo fixo de variável. Saídas sem categoria não entram em nenhum dos dois e aparecem como "não classificado" — reportadas em vez de escondidas, para que os números fechem com o total.',
    relacionados: ['financeiro-lancamentos', 'financeiro-fluxo'],
  },
  {
    id: 'financeiro-fluxo',
    titulo: 'Fluxo de caixa e faturamento',
    href: '/painel/financeiro',
    termos: [
      'fluxo de caixa',
      'caixa',
      'saldo',
      'faturamento',
      'quanto entrou',
      'quanto saiu',
      'relatorio',
      'grafico',
      'mes',
      'saldo nao bate',
      'lucro',
    ],
    resposta:
      'O fluxo de caixa soma o que foi **pago** no período: entradas menos saídas, separando custo fixo, variável e não classificado.\n\n' +
      'Dois avisos que evitam confusão:\n\n' +
      '• O saldo do período **não é o saldo do banco**. Ele mostra o movimento líquido daquele intervalo, não o dinheiro acumulado na conta.\n' +
      '• Saldo positivo **não é lucro**. Lucro depende de impostos, depreciação e do seu regime tributário — confirme com a contabilidade antes de decidir preço.\n\n' +
      'Se um número parece errado, quase sempre é baixa faltando: um lançamento sem baixa não entra no caixa do mês.',
    relacionados: ['financeiro-lancamentos', 'financeiro-margem', 'previsao'],
  },
  {
    id: 'financeiro-margem',
    titulo: 'Margem por serviço',
    href: '/painel/financeiro',
    termos: [
      'margem',
      'lucro por servico',
      'rentabilidade',
      'qual servico da lucro',
      'custo do servico',
      'comparar servicos',
    ],
    resposta:
      'O relatório de margem compara, por serviço, o que entrou com o custo registrado. É o número que planilha nenhuma costuma dar: **qual serviço realmente paga a conta**.\n\n' +
      'Para ele funcionar, duas coisas precisam estar em dia: o custo base preenchido no catálogo de serviços e os lançamentos financeiros vinculados ao serviço correspondente.',
    relacionados: ['servicos', 'financeiro-fluxo'],
  },
  {
    id: 'financeiro-conciliacao',
    titulo: 'Conciliação e importação de extrato',
    href: '/painel/financeiro/conciliacao',
    termos: [
      'conciliacao',
      'conciliar',
      'extrato',
      'importar extrato',
      'ofx',
      'banco',
      'bater com o banco',
      'exportar',
      'exportacao',
      'backup',
    ],
    resposta:
      'Em **Financeiro > Conciliação** você compara o que está no sistema com o extrato e resolve as diferenças.\n\n' +
      'Em **Financeiro > Dados** ficam a importação em lote e a exportação do período — útil para enviar à contabilidade ou guardar uma cópia.\n\n' +
      'A regra de ouro é a mesma do resto do módulo: só dê baixa depois de confirmar que o dinheiro entrou ou saiu.',
    relacionados: ['financeiro-lancamentos', 'financeiro-fluxo'],
  },
  {
    id: 'pro-labore',
    titulo: 'Pró-labore',
    href: '/painel/financeiro/pro-labore',
    termos: [
      'pro labore',
      'prolabore',
      'retirada',
      'salario do dono',
      'quanto posso tirar',
      'vigencia',
    ],
    resposta:
      'Em **Financeiro > Pró-labore**. O valor tem vigência: registros novos não apagam os antigos, o que permite recalcular meses passados com o valor que valia naquela época.\n\n' +
      'Separar a sua retirada das despesas da empresa é o que torna possível saber se o negócio se paga. Enquanto o pró-labore estiver misturado às saídas comuns, o custo operacional aparece inflado e a margem, menor do que é.',
    relacionados: ['financeiro-lancamentos', 'reservas'],
  },
  {
    id: 'reservas',
    titulo: 'Reservas financeiras',
    href: '/painel/financeiro/reservas',
    termos: ['reserva', 'reservas', 'guardar dinheiro', 'fundo', 'emergencia', 'aporte', 'resgate'],
    resposta:
      'Em **Financeiro > Reservas**. Cada reserva tem uma meta e recebe aportes e resgates, com o histórico de cada movimento.\n\n' +
      'Serve para separar o dinheiro que tem destino — impostos, 13º, troca de equipamento — do dinheiro livre em caixa. É o que impede o saldo aparentemente confortável de virar aperto no mês do vencimento.',
    relacionados: ['pro-labore', 'financeiro-fluxo'],
  },
  {
    id: 'previsao',
    titulo: 'Previsão financeira com IA',
    href: '/painel/financeiro/previsao',
    termos: [
      'previsao',
      'previsao financeira',
      'projecao',
      'projetar',
      'futuro',
      'ia',
      'inteligencia artificial',
      'cenario',
      'quanto vou faturar',
    ],
    resposta:
      'Em **Financeiro > Previsão com IA**, disponível no plano **Premium**. Você escolhe quantos meses de histórico analisar e quantos projetar.\n\n' +
      'A previsão considera muito mais que a média do extrato: histórico pago, contas a pagar e a receber já registradas, propostas em aberto ponderadas pela sua taxa de conversão, agendamentos futuros, compromissos recorrentes como pró-labore e reservas, e as contas vencidas.\n\n' +
      'O resultado traz saldo projetado mês a mês, cenários pessimista, base e otimista, pontos de atenção, oportunidades e ações recomendadas. É estimativa a partir do que está registrado — não é garantia de resultado nem substitui contador.\n\n' +
      'Quanto mais em dia estiverem as baixas e os vencimentos, mais próxima da realidade fica a projeção.',
    relacionados: ['plano', 'financeiro-fluxo', 'chat-ia'],
  },

  // --- Plataforma ----------------------------------------------------------
  {
    id: 'equipe',
    titulo: 'Equipe e convites',
    href: '/painel/equipe',
    termos: [
      'equipe',
      'usuario',
      'usuarios',
      'funcionario',
      'convidar',
      'convite',
      'adicionar pessoa',
      'remover acesso',
      'desativar usuario',
    ],
    resposta:
      'Em **Administração > Equipe** (só administradores). Você convida por e-mail, e a pessoa define a própria senha ao aceitar.\n\n' +
      'Cada usuário tem um papel — administrador, financeiro, atendente ou técnico — que já vem com um conjunto de permissões, e que pode ser ajustado ação por ação.\n\n' +
      'Desativar um usuário revoga o acesso na hora e preserva o histórico do que ele fez. O número de usuários influencia a mensalidade: acima das vagas inclusas no plano, cada usuário ativo adicional é cobrado à parte.',
    relacionados: ['permissoes', 'plano'],
  },
  {
    id: 'permissoes',
    titulo: 'Papéis e permissões',
    href: '/painel/equipe',
    termos: [
      'permissao',
      'permissoes',
      'papel',
      'acesso negado',
      'nao consigo ver',
      'nao aparece',
      'sumiu o menu',
      'administrador',
      'atendente',
      'tecnico',
      'financeiro',
    ],
    resposta:
      'As permissões são por ação, e não por tela inteira. Os padrões são:\n\n' +
      '• **Administrador** — tudo, incluindo equipe, configurações e histórico.\n' +
      '• **Financeiro** — módulo financeiro, serviços e IA; não vê a carteira de clientes.\n' +
      '• **Atendente** — clientes, funil, orçamentos, agenda e lembretes.\n' +
      '• **Técnico** — leitura do CRM, movimentação no funil e agenda.\n\n' +
      'Se um item não aparece no seu menu, é permissão faltando: peça ao administrador em **Equipe**. O menu esconde o que você não pode abrir, e a API recusa o acesso mesmo se alguém digitar o endereço direto.',
    relacionados: ['equipe', 'painel'],
  },
  {
    id: 'plano',
    titulo: 'Planos, limites e cobrança',
    href: '/painel/plano',
    termos: [
      'plano',
      'planos',
      'assinatura',
      'pagamento',
      'mensalidade',
      'cobranca',
      'basico',
      'premium',
      'upgrade',
      'limite',
      'preco do sistema',
      'quanto custa',
      'trial',
      'teste',
    ],
    resposta:
      'Em **Administração > Plano**. São dois:\n\n' +
      '• **Básico (R$ 100/mês)** — CRM, funil, agenda, clientes, financeiro completo e o assistente de ajuda do sistema. Inclui 2 usuários e até 500 clientes.\n' +
      '• **Premium (R$ 200/mês)** — tudo do Básico mais o assistente com IA conversando sobre os seus números e a previsão financeira com IA, com mais usuários e sem teto de clientes.\n\n' +
      'Usuários ativos além das vagas inclusas são cobrados por usuário adicional. A tela mostra o uso atual, os limites e a mensalidade estimada.\n\n' +
      'O acesso é garantido por um mês a partir de cada pagamento confirmado; quando o prazo se aproxima, um aviso aparece no topo do painel.',
    relacionados: ['chat-ia', 'previsao', 'equipe'],
  },
  {
    id: 'chat-ia',
    titulo: 'Assistente de ajuda e assistente com IA',
    href: '/painel/plano',
    termos: [
      'chat',
      'assistente',
      'bot',
      'ajuda',
      'duvida',
      'suporte',
      'ia',
      'inteligencia artificial',
      'conversar',
      'perguntar',
    ],
    resposta:
      'São dois assistentes diferentes:\n\n' +
      '• **Ajuda do sistema** (todos os planos) — sou eu. Explico como cada tela funciona, o que cada campo significa e por que um número aparece daquele jeito. Não consulto os dados da sua empresa, então respondo na hora e sem custo.\n' +
      '• **Assistente com IA** (plano Premium) — conversa sobre os **seus números**: caixa do mês, funil, propostas em aberto, agenda e follow-ups, respeitando as permissões de quem pergunta.\n\n' +
      'Nenhum dos dois altera registros nem envia mensagens no seu lugar.',
    relacionados: ['plano', 'previsao', 'permissoes'],
  },
  {
    id: 'historico',
    titulo: 'Histórico e auditoria',
    href: '/painel/historico',
    termos: [
      'historico',
      'auditoria',
      'log',
      'quem alterou',
      'quem excluiu',
      'o que mudou',
      'rastrear',
      'recuperar excluido',
    ],
    resposta:
      'Em **Administração > Histórico** (só administradores). Cada criação, alteração e exclusão fica registrada com autor, data, resumo e os valores de antes e depois.\n\n' +
      'É o que responde "quem mexeu nisso?" sem depender da memória de ninguém. O histórico não restaura registros excluídos — ele guarda o que havia neles, o que costuma bastar para recadastrar sem perder informação.',
    relacionados: ['permissoes', 'equipe'],
  },
  {
    id: 'configuracoes',
    titulo: 'Dados da empresa',
    href: '/painel/configuracoes',
    termos: [
      'configuracao',
      'configuracoes',
      'empresa',
      'dados da empresa',
      'cnpj da empresa',
      'nome da empresa',
      'mudar nome',
    ],
    resposta:
      'Em **Administração > Configurações**. Ali ficam nome, CNPJ, e-mail e telefone da empresa, além dos campos personalizados e das etiquetas de clientes.\n\n' +
      'Esses dados identificam a sua empresa dentro do sistema e aparecem nos documentos que ele gera.',
    relacionados: ['campos-personalizados', 'equipe'],
  },
  {
    id: 'conta-senha',
    titulo: 'Senha, sessão e segurança',
    href: '/painel',
    termos: [
      'senha',
      'trocar senha',
      'esqueci a senha',
      'recuperar senha',
      'sair',
      'logout',
      'sessao expirou',
      'seguranca',
      'lgpd',
      'meus dados',
    ],
    resposta:
      'Esqueceu a senha? Use "Recuperar senha" na tela de entrada — o link chega por e-mail.\n\n' +
      'A sessão expira por inatividade e se renova sozinha enquanto você estiver usando o sistema; quando expira de vez, a tela de entrada aparece de novo.\n\n' +
      'Os dados de cada empresa ficam isolados em três camadas, inclusive dentro do banco: uma empresa nunca enxerga registros de outra, nem por engano de programação.',
    relacionados: ['permissoes', 'equipe'],
  },
];

/**
 * Os assuntos que o assistente oferece quando não entende a pergunta.
 *
 * Uma lista curta e concreta funciona melhor que "reformule sua pergunta":
 * quem não sabe o nome da tela consegue reconhecer o assunto e seguir dali.
 */
export const ASSUNTOS_PRINCIPAIS: readonly string[] = [
  'Clientes e leads',
  'Funil de vendas',
  'Orçamentos e agenda',
  'Financeiro e fluxo de caixa',
  'Lembretes e reativação',
  'Equipe, permissões e plano',
];

/** Perguntas que abrem a conversa quando ela ainda não começou. */
export const SUGESTOES_DE_AJUDA: readonly string[] = [
  'Como cadastrar um cliente?',
  'Para que serve a lista de reativação?',
  'Por que o saldo do mês não bate com o banco?',
];
