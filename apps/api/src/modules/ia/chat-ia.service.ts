import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  PACOTE_IA_PRECO_MENSAL_BRL,
  type CapacidadesChat,
  type ChatIaInput,
  type ChatIaResponse,
  type ModoChat,
  type PainelTempoReal,
} from '@gestao/shared-types';
import { AssistenteIa, type PanoramaNegocio } from '../../infra/ia/assistente-ia';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../infra/tenant/tenant-context';
import { hojeEmDia } from '../financeiro/datas';
import { PainelService } from '../painel/painel.service';
import { AssistenteAjuda } from './ajuda/assistente-ajuda';
import { SUGESTOES_DE_AJUDA } from './ajuda/base-conhecimento';

const SUGESTOES_PREMIUM = [
  'Como está meu caixa este mês?',
  'Quais propostas devo cobrar primeiro?',
  'Quem eu deveria reativar esta semana?',
];

/**
 * O chat do painel.
 *
 * Duas conversas moram atrás da mesma janelinha, e o plano da empresa decide
 * qual delas abre:
 *
 * - **Ajuda** — explica o sistema. Não lê dado nenhum da empresa, responde na
 *   hora e custa zero. É o que todo plano tem.
 * - **IA** — conversa sobre os números do negócio, com modelo de linguagem e
 *   com o mesmo panorama que o painel mostra. Exclusiva do Premium.
 *
 * A decisão vem do banco a cada pergunta, nunca da tela: um upgrade passa a
 * valer na pergunta seguinte, e ninguém contorna o plano mexendo no navegador.
 */
@Injectable()
export class ChatIaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly painel: PainelService,
    private readonly assistente: AssistenteIa,
    private readonly ajuda: AssistenteAjuda,
  ) {}

  /** O que este usuário encontra ao abrir o chat, antes da primeira pergunta. */
  async capacidades(): Promise<CapacidadesChat> {
    const empresa = await this.empresaAtual();
    const modo = modoDoPlano(empresa.iaHabilitada);

    if (modo === 'ia') {
      return {
        modo,
        titulo: 'Assistente com IA',
        descricao: 'Conversa sobre os seus números',
        saudacao:
          `Olá! Sou o assistente com IA do ${empresa.nome}. ` +
          'Posso analisar caixa, funil, propostas, agenda e follow-ups — e explicar o que os números querem dizer. ' +
          'Vejo apenas o que o seu usuário tem permissão para ver.',
        sugestoes: SUGESTOES_PREMIUM,
        planoNome: empresa.planoNome,
        convite: null,
      };
    }

    return {
      modo,
      titulo: 'Ajuda do sistema',
      descricao: 'Tire dúvidas sobre como usar',
      saudacao:
        'Olá! Sou o assistente de ajuda. Explico como usar cada tela do sistema: clientes, leads, funil, ' +
        'orçamentos, agenda, lembretes, financeiro, equipe e plano. Pergunte à vontade.',
      sugestoes: [...SUGESTOES_DE_AJUDA],
      planoNome: empresa.planoNome,
      convite: `Quer conversar sobre os seus números? O assistente com IA faz parte do Premium, por R$ ${PACOTE_IA_PRECO_MENSAL_BRL}/mês.`,
    };
  }

  async responder(dados: ChatIaInput): Promise<ChatIaResponse> {
    const empresa = await this.empresaAtual();

    if (modoDoPlano(empresa.iaHabilitada) === 'ajuda') {
      return this.responderComAjuda(dados);
    }

    return this.responderComIa(dados, empresa.nome);
  }

  /** Plano Básico: só o sistema, sem tocar nos dados da empresa. */
  private responderComAjuda(dados: ChatIaInput): ChatIaResponse {
    const resultado = this.ajuda.responder(dados.mensagem, dados.historico);

    return {
      modo: 'ajuda',
      resposta: resultado.resposta,
      sugestoes: resultado.sugestoes,
      referencias: resultado.referencias,
      geradaPorModelo: false,
    };
  }

  /**
   * Plano Premium: o modelo responde sobre o negócio.
   *
   * ## Por que o panorama vem do painel
   *
   * O painel já lê tudo o que a conversa precisa — leads, funil, comercial,
   * agenda, follow-ups, reativação e caixa — numa transação só e **já filtrado
   * pelas permissões de quem pediu**. Montar uma segunda coleta aqui
   * significaria manter duas versões da mesma verdade, e a primeira vez que
   * elas divergissem o assistente passaria a contradizer a tela que a pessoa
   * está olhando.
   */
  private async responderComIa(dados: ChatIaInput, empresaNome: string): Promise<ChatIaResponse> {
    const contexto = exigirContextoTenant();
    const painel = await this.painel.tempoReal();

    const resultado = await this.assistente.conversar({
      // Hash do par empresa/usuário: identifica de forma estável para o
      // controle de abuso do fornecedor sem exportar identificador interno.
      identificadorSeguro: createHash('sha256')
        .update(`${contexto.tenantId}:${contexto.usuarioId}`)
        .digest('hex'),
      pergunta: dados.mensagem,
      historico: dados.historico,
      papel: contexto.papel,
      panorama: montarPanorama(painel, empresaNome),
    });

    return {
      modo: 'ia',
      resposta: resultado.texto,
      sugestoes: resultado.sugestoes.length > 0 ? resultado.sugestoes : SUGESTOES_PREMIUM,
      referencias: [],
      geradaPorModelo: resultado.modo === 'openai',
    };
  }

  private async empresaAtual(): Promise<{
    nome: string;
    planoNome: string;
    iaHabilitada: boolean;
  }> {
    const tenant = await this.prisma.comTenant((tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantAtual() },
        select: { nome: true, plano: { select: { nome: true, iaHabilitada: true } } },
      }),
    );

    return {
      nome: tenant.nome,
      planoNome: tenant.plano.nome,
      iaHabilitada: tenant.plano.iaHabilitada,
    };
  }
}

function modoDoPlano(iaHabilitada: boolean): ModoChat {
  return iaHabilitada ? 'ia' : 'ajuda';
}

/**
 * Converte a leitura do painel no retrato enviado ao modelo.
 *
 * Só o que ajuda a responder: contagens, somas e as etapas do funil. Nomes de
 * clientes, ids e listas longas ficam de fora — eles encareceriam a pergunta
 * sem melhorar a resposta, e não há motivo para mandar dado pessoal a um
 * fornecedor externo quando o total já responde.
 */
function montarPanorama(painel: PainelTempoReal, empresaNome: string): PanoramaNegocio {
  return {
    empresa: empresaNome,
    hoje: hojeEmDia(),
    carteira: painel.leads
      ? {
          clientes: painel.totalClientes,
          leadsSeteDias: painel.leads.seteDias,
          leadsAguardandoContato: painel.leads.aguardandoContato,
          clientesParaReativar: painel.reativacao?.total ?? 0,
        }
      : undefined,
    funil: painel.funil
      ? {
          clientes: painel.funil.total,
          negociacoesParadas: painel.funil.paradas.length,
          etapas: painel.funil.etapas.map((etapa) => ({
            etapa: etapa.nome,
            clientes: etapa.clientes,
            valorEmAberto: etapa.valor,
          })),
        }
      : undefined,
    comercial: painel.comercial
      ? {
          propostasAbertas: painel.comercial.abertos.quantidade,
          valorEmAberto: painel.comercial.abertos.valor,
          aprovadosNoMes: painel.comercial.aprovadosMes.valor,
          recusadosNoMes: painel.comercial.recusadosMes.valor,
          taxaConversaoMes: painel.comercial.taxaConversaoMes,
          ticketMedio: painel.comercial.ticketMedio,
          propostasVencendo: painel.comercial.vencendo.length,
        }
      : undefined,
    agenda: painel.agenda
      ? {
          hoje: painel.agenda.hoje.length,
          proximosSeteDias: painel.agenda.seteDias,
          atrasados: painel.agenda.atrasados,
        }
      : undefined,
    followUps: painel.followUps
      ? { pendentes: painel.followUps.pendentes, atrasados: painel.followUps.atrasados }
      : undefined,
    financeiro: painel.financeiro
      ? {
          entradasMes: painel.financeiro.entradasMes,
          saidasMes: painel.financeiro.saidasMes,
          saldoMes: painel.financeiro.saldoMes,
          aReceber: painel.financeiro.aReceber,
          aPagar: painel.financeiro.aPagar,
          vencidoAPagar: painel.financeiro.vencidosAPagar.valor,
          vencidoAReceber: painel.financeiro.vencidosAReceber.valor,
          ultimosMeses: painel.financeiro.serie,
        }
      : undefined,
  };
}
