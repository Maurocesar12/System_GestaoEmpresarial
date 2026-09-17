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
      'Comece por aqui: cadastre seus **serviços** (com o custo de cada um), depois seus **clientes**, monte o primeiro **orçamento** e registre as entradas e saídas no **financeiro**.\n\n' +
      'Feito isso, o Painel já começa a fazer sentido: ele mostra o que chegou, o que está parado e o que vence.\n\n' +
      '**Dica:** comece pelos serviços — sem o custo de cada um, o sistema não tem como calcular sua margem depois.',
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
      'O painel mostra o que importa agora: alertas no topo (leads sem contato, contas vencidas, compromissos atrasados) e, logo abaixo, leads novos, clientes para reativar, funil, agenda e caixa.\n\n' +
      'Ele se atualiza sozinho a cada 30 segundos — dá para pausar se você estiver lendo com calma.\n\n' +
      '**Dica:** cada pessoa só vê os blocos que a sua permissão libera. Se falta algum número, é permissão, não bug.',
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
      'Vá em **Clientes > Novo cliente**. Só o nome é obrigatório — o resto (telefone, e-mail, CPF/CNPJ) pode completar depois.\n\n' +
      'Se a pessoa acabou de ligar, use o botão "Novo lead" direto no Início: cadastra na hora, sem sair da tela.\n\n' +
      '**Dica:** pode digitar telefone e documento sem máscara, o sistema formata sozinho. E todo cliente novo já entra na primeira etapa do funil.',
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
      'Em **Clientes > Importar planilha**: você sobe o arquivo, confere as colunas e confirma. Funciona até com planilhas grandes.\n\n' +
      'Linha repetida (mesmo CPF, CNPJ ou e-mail) é pulada, não trava a importação inteira, e o motivo aparece pra você conferir.\n\n' +
      '**Dica:** se o total passar do limite de clientes do seu plano, nada é importado — a mensagem já avisa quantas vagas sobram.',
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
      'É no **Início**, no cartão "Leads que chegaram": todo cliente cadastrado nos últimos 30 dias, do mais novo pro mais antigo.\n\n' +
      'A situação (aguardando contato, em contato, proposta enviada, fechado) é calculada sozinha. Quem espera contato há mais de 24h aparece destacado.\n\n' +
      'Para cadastrar um lead novo, use o botão "Novo lead" no próprio cartão — pede só o nome, o resto você completa depois na ficha.\n\n' +
      '**Dica:** preencha a origem sempre que souber de onde a pessoa veio, é o que faz o resumo por canal valer a pena.',
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
      'No **Início**, no cartão "Clientes para reativar": quem está há mais de 60 dias sem contato e sem nada em aberto.\n\n' +
      'A lista vem ordenada por quanto o cliente já gastou com você, e cada linha diz o motivo — comprou e sumiu, recusou a proposta, nunca fechou.\n\n' +
      '**Dica:** assim que você registra um contato ou marca um retorno, o cliente sai da lista sozinho.',
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
      'Abra a ficha do cliente em **Clientes** e registre no bloco de atendimentos: data e o que foi conversado.\n\n' +
      '**Dica:** vale o hábito — isso tira o cliente da fila de "aguardando contato" e da lista de reativação, além de ficar guardado pra quem atender da próxima vez.',
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
      'Em **Configurações**: campos personalizados criam informações que só a sua empresa precisa (texto, número, data ou lista), e etiquetas coloridas ajudam a separar clientes por prioridade ou tipo.\n\n' +
      '**Dica:** dá pra marcar um campo como obrigatório — a partir daí, ninguém cadastra cliente sem preenchê-lo.',
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
      'Em **Relacionamento > Funil**. Cada coluna é uma etapa, cada cartão é um cliente — arraste para mover, livre pra frente, pra trás ou pulando etapa.\n\n' +
      '**Dica:** cliente parado mais de 7 dias na mesma etapa aparece destacado nos alertas do painel. E quem ainda não está em etapa nenhuma aparece como "fora do funil", pronto pra ser puxado pro quadro.',
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
      'Em **Funil > Etapas** (só administradores): criar, renomear, reordenar e excluir etapas.\n\n' +
      'Cada etapa pode ganhar um marco — "orçamento enviado" ou "fechado" — que é o que dispara a automação sozinha.\n\n' +
      '**Dica:** pode renomear a etapa à vontade, a automação segue o marco, não o nome.',
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
      'Em **Operação > Orçamentos**: cliente, serviço, valor e validade opcional.\n\n' +
      'Três estados — aberto, aprovado, recusado — e dá pra reabrir se a conversa voltar. Aprovar já move o cliente pro funil sozinho.\n\n' +
      '**Dica:** só dá pra editar enquanto está aberto. Depois de aprovado, o valor fica travado — mudar seria alterar um compromisso já fechado.',
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
      'Em **Operação > Agenda**: cliente, serviço, data e hora.\n\n' +
      'O ciclo é agendado → confirmado → executado (ou cancelado, com opção de reagendar). Passou da hora e ainda tá agendado? Aparece atrasado no painel.\n\n' +
      '**Dica:** marcar como executado é definitivo — é o gesto que fecha a operação e já prepara o lançamento financeiro do serviço.',
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
      'Em **Operação > Serviços**: nome, categoria opcional, custo base e preço padrão.\n\n' +
      '**Dica:** preencha sempre o custo base — é o que sai do seu bolso pra entregar o serviço, e é o que permite ao relatório dizer qual serviço realmente dá lucro. Serviço parado? Desative em vez de excluir, assim ele some das listas novas mas continua nos relatórios antigos.',
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
      'Em **Relacionamento > Lembretes**: escolha o cliente, o canal e a data.\n\n' +
      'Por **e-mail**, o envio é automático. Por **WhatsApp**, ainda não — depende de aprovação da Meta, então esses ficam marcados como falha, com o motivo explicado.\n\n' +
      '**Dica:** lembrete pendente com data já passada aparece como atrasado no painel, pra você não perder o retorno.',
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
      'Em **Financeiro > Movimento**: tipo (entrada ou saída), valor, data, vencimento, categoria e natureza (empresa ou pessoal).\n\n' +
      '**Dar baixa** é o que marca quando o dinheiro realmente se moveu. Sem baixa, é só uma conta a pagar ou a receber.\n\n' +
      '**Dica:** deu baixa errado? Dá pra estornar, e o lançamento volta a ficar em aberto.',
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
      'Em **Financeiro > Categorias**: além do nome, cada categoria de saída tem um tipo de custo — fixo (existe mesmo sem venda, tipo aluguel) ou variável (cresce com o volume, tipo material).\n\n' +
      '**Dica:** saída sem categoria aparece como "não classificado" no fluxo de caixa, pra nenhum valor ficar escondido.',
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
      'O fluxo de caixa soma o que foi pago no período: entradas menos saídas.\n\n' +
      'Dois avisos importantes: o saldo do período não é o saldo do banco (é só o movimento daquele intervalo), e saldo positivo não é lucro (isso depende de impostos e do seu regime — confirme com seu contador).\n\n' +
      '**Dica:** número estranho? É quase sempre baixa faltando — um lançamento sem baixa não entra no caixa do mês.',
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
      'O relatório de margem compara, por serviço, o que entrou com o custo registrado — mostra qual serviço realmente paga a conta.\n\n' +
      '**Dica:** só funciona bem se o custo base do serviço estiver preenchido e os lançamentos vinculados a ele.',
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
      'Em **Financeiro > Conciliação**, você compara o sistema com o extrato do banco e resolve as diferenças. Importação em lote e exportação ficam em **Financeiro > Dados**.\n\n' +
      '**Dica:** a regra é sempre a mesma — só dê baixa depois de confirmar que o dinheiro realmente entrou ou saiu.',
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
      'Em **Financeiro > Pró-labore**: o valor tem vigência, então registros novos não apagam os antigos.\n\n' +
      '**Dica:** separar sua retirada das despesas da empresa é o que revela se o negócio realmente se sustenta sozinho.',
    relacionados: ['financeiro-lancamentos', 'reservas'],
  },
  {
    id: 'reservas',
    titulo: 'Reservas financeiras',
    href: '/painel/financeiro/reservas',
    termos: ['reserva', 'reservas', 'guardar dinheiro', 'fundo', 'emergencia', 'aporte', 'resgate'],
    resposta:
      'Em **Financeiro > Reservas**: cada reserva tem uma meta e recebe aportes e resgates, com histórico.\n\n' +
      '**Dica:** serve pra guardar o dinheiro que já tem destino (impostos, 13º, equipamento) separado do caixa livre, e evitar susto no mês do vencimento.',
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
      'Em **Financeiro > Previsão com IA** (plano Premium): escolha quantos meses olhar pra trás e quantos projetar.\n\n' +
      'Ela cruza histórico, contas a pagar/receber, propostas em aberto, agenda e compromissos recorrentes, trazendo cenário pessimista, base e otimista.\n\n' +
      '**Dica:** é estimativa, não garantia — quanto mais em dia as baixas, mais perto da realidade fica a projeção.',
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
      'Em **Administração > Equipe** (só administradores): convide por e-mail, a pessoa define a própria senha ao aceitar.\n\n' +
      'Cada papel já vem com permissões prontas, ajustáveis uma a uma.\n\n' +
      '**Dica:** desativar um usuário revoga o acesso na hora, preserva o histórico dele e libera a vaga do plano.',
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
      'As permissões são por ação, não por tela inteira:\n\n' +
      '• **Administrador** — tudo.\n' +
      '• **Financeiro** — módulo financeiro, serviços e IA.\n' +
      '• **Atendente** — clientes, funil, orçamentos, agenda e lembretes.\n' +
      '• **Técnico** — leitura do CRM, funil e agenda.\n\n' +
      '**Dica:** menu sumiu? É permissão faltando — peça pro administrador ajustar em **Equipe**.',
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
      'Em **Administração > Plano**, são dois:\n\n' +
      '• **Básico (R$ 100/mês)** — CRM, funil, agenda, financeiro completo e esta ajuda. 2 usuários, até 500 clientes.\n' +
      '• **Premium (R$ 200/mês)** — tudo isso, mais o assistente com IA e a previsão financeira, com mais usuários e sem limite de clientes.\n\n' +
      '**Dica:** a tela mostra seu uso atual e a mensalidade estimada, já com usuários extras.',
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
      'Somos dois assistentes diferentes:\n\n' +
      '• **Eu**, a ajuda do sistema — explico como usar as telas, em todos os planos, sem tocar nos seus dados.\n' +
      '• O **assistente com IA** (Premium) — conversa sobre seus números de verdade: caixa, funil, propostas.\n\n' +
      '**Dica:** nenhum dos dois altera cadastros nem envia mensagens por você.',
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
      'Em **Administração > Histórico** (só administradores): toda criação, alteração e exclusão fica registrada com autor, data e os valores de antes e depois.\n\n' +
      '**Dica:** ele não restaura registros excluídos, mas guarda o que tinha neles — geralmente dá pra recadastrar sem perder nada.',
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
      'Em **Administração > Configurações**: nome, CNPJ, e-mail e telefone da empresa, além de campos personalizados e etiquetas de clientes.',
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
      'Esqueceu a senha? Use "Recuperar senha" na tela de entrada — o link chega no seu e-mail.\n\n' +
      'A sessão se renova sozinha enquanto você usa o sistema.\n\n' +
      '**Dica:** seus dados ficam isolados por empresa em várias camadas — nenhuma empresa enxerga os dados de outra.',
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
