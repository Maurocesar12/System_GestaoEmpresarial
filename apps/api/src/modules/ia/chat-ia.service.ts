import { Injectable } from '@nestjs/common';
import {
  formatarBRL,
  permissoesDoUsuario,
  type ChatIaInput,
  type ChatIaResponse,
  type Permissao,
} from '@gestao/shared-types';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { exigirContextoTenant } from '../../infra/tenant/tenant-context';

interface ContextoChat {
  clientes?: { total: number; novos30Dias: number };
  financeiro?: {
    entradasMes: string;
    saidasMes: string;
    saldoMes: string;
    aReceber: string;
    aPagar: string;
  };
  orcamentos?: { abertos: number; valorAberto: string; aprovados: number; valorAprovado: string };
  agenda?: { proximos: number };
  lembretes?: { pendentes: number; atrasados: number };
}

const SUGESTOES_PADRAO = [
  'Como está meu caixa este mês?',
  'Quais pontos precisam de atenção?',
  'Resumo dos clientes e orçamentos',
];

@Injectable()
export class ChatIaService {
  constructor(private readonly prisma: PrismaService) {}

  async responder(dados: ChatIaInput): Promise<ChatIaResponse> {
    const tenant = exigirContextoTenant();
    const permissoes = permissoesDoUsuario(tenant.papel, tenant.permissoes);
    const contexto = await this.montarContexto(permissoes);

    return {
      modo: 'gratuito',
      resposta: this.gerarResposta(dados.mensagem, contexto),
      sugestoes: this.sugerirProximasPerguntas(contexto),
    };
  }

  private async montarContexto(permissoes: Permissao[]): Promise<ContextoChat> {
    const podeVer = (permissao: Permissao) => permissoes.includes(permissao);
    const inicioMes = primeiroDiaDoMes(new Date());
    const inicio30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hoje = new Date();

    const [clientes, financeiro, orcamentos, agenda, lembretes] = await this.prisma.comTenant(
      async (tx) =>
        Promise.all([
          podeVer('clientes.visualizar')
            ? Promise.all([
                tx.cliente.count(),
                tx.cliente.count({ where: { criadoEm: { gte: inicio30Dias } } }),
              ])
            : null,
          podeVer('financeiro.visualizar')
            ? Promise.all([
                tx.lancamentoFinanceiro.groupBy({
                  by: ['tipo'],
                  where: {
                    natureza: 'empresa',
                    pagoEm: { gte: inicioMes, lte: fimDoDia(hoje) },
                  },
                  _sum: { valor: true },
                }),
                tx.lancamentoFinanceiro.groupBy({
                  by: ['tipo'],
                  where: { natureza: 'empresa', pagoEm: null },
                  _sum: { valor: true },
                }),
              ])
            : null,
          podeVer('orcamentos.visualizar')
            ? tx.orcamento.groupBy({
                by: ['status'],
                _count: { _all: true },
                _sum: { valor: true },
              })
            : null,
          podeVer('agenda.visualizar')
            ? tx.agendamento.count({
                where: { dataHora: { gte: hoje }, status: { in: ['agendado', 'confirmado'] } },
              })
            : null,
          podeVer('lembretes.visualizar')
            ? Promise.all([
                tx.lembreteFollowUp.count({ where: { status: 'pendente' } }),
                tx.lembreteFollowUp.count({
                  where: { status: 'pendente', dataEnvio: { lt: hoje } },
                }),
              ])
            : null,
        ]),
    );

    return {
      clientes: clientes ? { total: clientes[0], novos30Dias: clientes[1] } : undefined,
      financeiro: financeiro ? this.mapearFinanceiro(financeiro[0], financeiro[1]) : undefined,
      orcamentos: orcamentos ? this.mapearOrcamentos(orcamentos) : undefined,
      agenda: agenda !== null ? { proximos: agenda } : undefined,
      lembretes: lembretes ? { pendentes: lembretes[0], atrasados: lembretes[1] } : undefined,
    };
  }

  private gerarResposta(pergunta: string, contexto: ContextoChat): string {
    const texto = normalizar(pergunta);

    if (contem(texto, ['como usar', 'funcionalidade', 'o que voce faz', 'como funciona', 'como criar', 'como cadastrar', 'como organizar'])) {
      return 'Posso consultar resumos permitidos e orientar o uso do sistema.\n\nClientes: mantenha os contatos e as etiquetas organizados. No CRM, acompanhe os cards pelas etapas do funil.\n\nOrçamentos: registre propostas e acompanhe aprovações. Agenda e Lembretes ajudam a organizar atendimentos e retornos.\n\nFinanceiro: registre entradas, saídas, vencimentos e baixas. Categorias, Reservas e Pró-labore ajudam a separar despesas e retiradas. A Previsão usa o histórico e as contas futuras registradas.\n\nHistórico permite consultar registros antigos disponíveis à sua conta. Eu não altero registros nem envio mensagens por você; os recursos visíveis dependem das suas permissões.';
    }

    if (contem(texto, ['dica', 'atencao', 'prioridade', 'recomenda', 'melhorar', 'economizar', 'reserva', 'pro-labore', 'pro labore', 'lucro', 'custo'])) {
      return dicasGerenciais(contexto);
    }

    if (contem(texto, ['resumo', 'panorama'])) return respostaGeral(contexto);

    if (contem(texto, ['crm', 'funil', 'card', 'etiqueta'])) {
      return 'No CRM, organize os cards por etapa e use etiquetas para identificar prioridades e tipos de cliente. Revise oportunidades paradas e registre lembretes de retorno. Não tenho nesta consulta os dados de movimentação dos cards para apontar quais estão parados.';
    }

    if (contem(texto, ['previsao', 'projecao'])) {
      return 'Em Financeiro > Previsão, escolha o histórico e o período projetado. Confira o saldo acumulado, as entradas e saídas e as recomendações. O modo gratuito usa análise local por regras; atualize as contas e as baixas antes de gerar. Não estou consultando sua última previsão nesta conversa.';
    }

    if (contem(texto, ['historico', 'excluido', 'exclusao', 'auditoria'])) {
      return 'Consulte a aba Histórico para buscar registros antigos disponíveis à sua conta. Esta conversa não acessa os detalhes de exclusões nem restaura registros.';
    }

    if (contem(texto, ['caixa', 'financeiro', 'entrada', 'saida', 'saldo', 'pagar', 'receber'])) {
      return contexto.financeiro
        ? respostaFinanceira(contexto.financeiro)
        : 'Você não tem permissão para ver os dados financeiros. Posso ajudar com clientes, agenda ou orçamentos disponíveis para o seu usuário.';
    }

    if (contem(texto, ['cliente', 'lead', 'carteira'])) {
      return contexto.clientes
        ? `Sua carteira tem ${contexto.clientes.total} cliente(s), com ${contexto.clientes.novos30Dias} novo(s) nos últimos 30 dias.`
        : 'Você não tem permissão para visualizar clientes nesta conta.';
    }

    if (contem(texto, ['orcamento', 'proposta', 'venda', 'fechado', 'aprovado'])) {
      return contexto.orcamentos
        ? respostaOrcamentos(contexto.orcamentos)
        : 'Você não tem permissão para visualizar orçamentos nesta conta.';
    }

    if (contem(texto, ['agenda', 'compromisso', 'atendimento', 'horario'])) {
      return contexto.agenda
        ? `Existem ${contexto.agenda.proximos} compromisso(s) futuros agendados ou confirmados.`
        : 'Você não tem permissão para visualizar a agenda nesta conta.';
    }

    if (contem(texto, ['lembrete', 'follow', 'follow-up', 'retorno'])) {
      return contexto.lembretes
        ? `Há ${contexto.lembretes.pendentes} follow-up(s) pendente(s), sendo ${contexto.lembretes.atrasados} atrasado(s).`
        : 'Você não tem permissão para visualizar lembretes nesta conta.';
    }

    return respostaGeral(contexto);
  }

  private sugerirProximasPerguntas(contexto: ContextoChat): string[] {
    const sugestoes = [];
    if (contexto.financeiro) sugestoes.push('Quais dicas financeiras são prioridade?');
    if (contexto.financeiro) sugestoes.push('Como está meu caixa este mês?');
    if (contexto.orcamentos) sugestoes.push('Quanto tenho em orçamento aberto?');
    if (contexto.lembretes) sugestoes.push('Tenho follow-ups atrasados?');
    if (contexto.clientes) sugestoes.push('Quantos clientes novos entraram?');
    return sugestoes.slice(0, 3).length > 0 ? sugestoes.slice(0, 3) : SUGESTOES_PADRAO;
  }

  private mapearFinanceiro(
    fluxo: Array<{ tipo: 'entrada' | 'saida'; _sum: { valor: Prisma.Decimal | null } }>,
    aberto: Array<{ tipo: 'entrada' | 'saida'; _sum: { valor: Prisma.Decimal | null } }>,
  ): ContextoChat['financeiro'] {
    const entradas = valorPorTipo(fluxo, 'entrada');
    const saidas = valorPorTipo(fluxo, 'saida');
    return {
      entradasMes: moeda(entradas),
      saidasMes: moeda(saidas),
      saldoMes: moeda(entradas.minus(saidas)),
      aReceber: moeda(valorPorTipo(aberto, 'entrada')),
      aPagar: moeda(valorPorTipo(aberto, 'saida')),
    };
  }

  private mapearOrcamentos(
    grupos: Array<{
      status: 'aberto' | 'aprovado' | 'recusado';
      _count: { _all: number };
      _sum: { valor: Prisma.Decimal | null };
    }>,
  ): ContextoChat['orcamentos'] {
    const abertos = grupos.find((item) => item.status === 'aberto');
    const aprovados = grupos.find((item) => item.status === 'aprovado');
    return {
      abertos: abertos?._count._all ?? 0,
      valorAberto: moeda(abertos?._sum.valor ?? new Prisma.Decimal(0)),
      aprovados: aprovados?._count._all ?? 0,
      valorAprovado: moeda(aprovados?._sum.valor ?? new Prisma.Decimal(0)),
    };
  }
}

function respostaFinanceira(financeiro: NonNullable<ContextoChat['financeiro']>): string {
  const saldo = Number(financeiro.saldoMes);
  const leitura =
    saldo < 0
      ? 'O mês está com saldo negativo; vale priorizar recebimentos e revisar saídas próximas.'
      : saldo === 0
        ? 'O movimento líquido do mês está zerado; confirme se todas as baixas foram registradas.'
        : 'As entradas superam as saídas no mês; mantenha as baixas atualizadas.';

  return `Neste mês entraram ${formatarBRL(financeiro.entradasMes)} e saíram ${formatarBRL(financeiro.saidasMes)}, com movimento líquido de ${formatarBRL(financeiro.saldoMes)}. Esse movimento não representa o saldo bancário total nem o lucro contábil.\n\nEm aberto, considerando todos os vencimentos, há ${formatarBRL(financeiro.aReceber)} a receber e ${formatarBRL(financeiro.aPagar)} a pagar. ${leitura}`;
}

function respostaOrcamentos(orcamentos: NonNullable<ContextoChat['orcamentos']>): string {
  return `Você tem ${orcamentos.abertos} orçamento(s) em aberto, somando ${formatarBRL(orcamentos.valorAberto)}. Também há ${orcamentos.aprovados} aprovado(s), somando ${formatarBRL(orcamentos.valorAprovado)}.`;
}

function respostaGeral(contexto: ContextoChat): string {
  const partes = [
    'Sou o assistente gratuito, com análise local por regras dos dados que você tem permissão para ver.',
  ];

  if (contexto.financeiro) partes.push(respostaFinanceira(contexto.financeiro));
  if (contexto.orcamentos) partes.push(respostaOrcamentos(contexto.orcamentos));
  if (contexto.clientes) {
    partes.push(
      `Na carteira, há ${contexto.clientes.total} cliente(s), com ${contexto.clientes.novos30Dias} novo(s) nos últimos 30 dias.`,
    );
  }
  if (contexto.lembretes) {
    partes.push(
      `Nos follow-ups, existem ${contexto.lembretes.pendentes} pendente(s), sendo ${contexto.lembretes.atrasados} atrasado(s).`,
    );
  }

  if (contexto.agenda) partes.push(`Há ${contexto.agenda.proximos} compromisso(s) futuros agendados ou confirmados.`);
  return partes.join('\n\n');
}

function dicasGerenciais(contexto: ContextoChat): string {
  const dicas: string[] = [];
  if (contexto.financeiro) {
    dicas.push(respostaFinanceira(contexto.financeiro));
    if (Number(contexto.financeiro.saldoMes) < 0) dicas.push('Prioridade: revise as saídas por categoria e confira os recebimentos pendentes antes de assumir novos compromissos.');
    if (Number(contexto.financeiro.aPagar) > Number(contexto.financeiro.aReceber)) dicas.push('As contas a pagar em aberto superam as contas a receber. Compare os vencimentos no Financeiro e o caixa disponível; essa diferença sozinha não significa falta de caixa.');
    dicas.push('Rotina financeira: dê baixa somente após confirmar o pagamento, separe o pró-labore das despesas da empresa e planeje reservas a partir dos gastos essenciais.');
    dicas.push('Antes de definir preços, confira custos diretos, despesas, taxas e impostos com o responsável contábil. Faturamento e saldo positivo não são sinônimos de lucro.');
  }
  if (contexto.orcamentos?.abertos) dicas.push(`Comercial: acompanhe os ${contexto.orcamentos.abertos} orçamentos abertos (${formatarBRL(contexto.orcamentos.valorAberto)}) com retornos combinados. Não conte propostas abertas como recebimento garantido.`);
  if (contexto.lembretes?.atrasados) dicas.push(`Atendimento: revise primeiro os ${contexto.lembretes.atrasados} lembretes atrasados e reagende os retornos necessários.`);
  if (contexto.agenda?.proximos) dicas.push(`Agenda: confirme os ${contexto.agenda.proximos} atendimentos futuros e confira se os serviços realizados tiveram os lançamentos correspondentes.`);
  return dicas.length ? dicas.join('\n\n') : 'Não há dados autorizados suficientes para personalizar dicas. Posso explicar como usar as funcionalidades do sistema.';
}

function valorPorTipo(
  itens: Array<{ tipo: 'entrada' | 'saida'; _sum: { valor: Prisma.Decimal | null } }>,
  tipo: 'entrada' | 'saida',
): Prisma.Decimal {
  return itens.find((item) => item.tipo === tipo)?._sum.valor ?? new Prisma.Decimal(0);
}

function moeda(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}

function contem(texto: string, termos: string[]): boolean {
  return termos.some((termo) => texto.includes(termo));
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function primeiroDiaDoMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

function fimDoDia(data: Date): Date {
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 23, 59, 59, 999),
  );
}
