import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CODIGOS_ERRO,
  NOME_CLIENTE_ANONIMIZADO,
  TEXTO_REMOVIDO_LGPD,
  calcularExclusaoPrevista,
  type CancelamentoContaInput,
  type ContaCancelada,
  type DadosDoTitular,
  type ExportacaoEmpresa,
} from '@gestao/shared-types';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { exigirContextoTenant, tenantAtual } from '../../../infra/tenant/tenant-context';
import { SenhaService } from '../../auth/senha.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

const RESUMO_LOG_ANONIMIZADO = 'Dados pessoais removidos a pedido do titular (LGPD).';

const paraDia = (data: Date): string => data.toISOString().slice(0, 10);

const normalizarNome = (nome: string): string =>
  nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/**
 * Direitos do titular e encerramento de conta (LGPD, arquitetura §9.4).
 *
 * A empresa assinante é a controladora dos dados dos clientes dela; o SaaS é o
 * operador. Por isso quem atende o pedido do titular é a própria empresa, por
 * estas rotas — o sistema só garante que o atendimento seja completo.
 */
@Injectable()
export class LgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly senhas: SenhaService,
  ) {}

  async dadosDoTitular(clienteId: string): Promise<DadosDoTitular> {
    return this.prisma.comTenant(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteId },
        include: {
          tenant: { select: { nome: true } },
          posicaoFunil: { select: { etapa: { select: { nome: true } } } },
          etiquetas: { select: { etiqueta: { select: { nome: true } } } },
          atendimentos: { orderBy: { data: 'asc' } },
          orcamentos: {
            orderBy: { criadoEm: 'asc' },
            include: { servico: { select: { nome: true } } },
          },
          agendamentos: {
            orderBy: { dataHora: 'asc' },
            include: { servico: { select: { nome: true } } },
          },
          lembretes: { orderBy: { dataEnvio: 'asc' } },
          lancamentos: { orderBy: { data: 'asc' } },
        },
      });

      if (!cliente) throw this.clienteNaoEncontrado();

      const campos = await tx.campoPersonalizado.findMany({ select: { id: true, nome: true } });
      const nomeDoCampo = new Map(campos.map((campo) => [campo.id, campo.nome]));
      const valores = cliente.camposPersonalizados as Record<string, string>;

      // Sem o nome no resumo: o próprio histórico não deve virar mais uma cópia
      // do dado pessoal que acabou de ser entregue.
      await this.auditoria.registrar(tx, {
        entidade: 'cliente',
        entidadeId: cliente.id,
        acao: 'exportou',
        resumo: 'Dados pessoais do cliente exportados a pedido do titular (LGPD).',
      });

      return {
        geradoEm: new Date().toISOString(),
        empresa: cliente.tenant.nome,
        cliente: {
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          documento: cliente.documento,
          observacoes: cliente.observacoes,
          origem: cliente.origem,
          utmSource: cliente.utmSource,
          utmMedium: cliente.utmMedium,
          utmCampaign: cliente.utmCampaign,
          etapaFunil: cliente.posicaoFunil?.etapa.nome ?? null,
          etiquetas: cliente.etiquetas.map((item) => item.etiqueta.nome),
          camposPersonalizados: Object.entries(valores)
            .filter(([, valor]) => valor)
            .map(([id, valor]) => ({ campo: nomeDoCampo.get(id) ?? 'Campo removido', valor })),
          criadoEm: cliente.criadoEm.toISOString(),
          atualizadoEm: cliente.atualizadoEm.toISOString(),
        },
        atendimentos: cliente.atendimentos.map((item) => ({
          data: paraDia(item.data),
          descricao: item.descricao,
        })),
        orcamentos: cliente.orcamentos.map((item) => ({
          servico: item.servico?.nome ?? null,
          descricao: item.descricao,
          valor: item.valor.toFixed(2),
          status: item.status,
          validoAte: item.validoAte ? paraDia(item.validoAte) : null,
          criadoEm: item.criadoEm.toISOString(),
        })),
        agendamentos: cliente.agendamentos.map((item) => ({
          servico: item.servico?.nome ?? null,
          dataHora: item.dataHora.toISOString(),
          status: item.status,
          observacoes: item.observacoes,
        })),
        lembretes: cliente.lembretes.map((item) => ({
          canal: item.canal,
          status: item.status,
          dataEnvio: item.dataEnvio.toISOString(),
          enviadoEm: item.enviadoEm?.toISOString() ?? null,
        })),
        lancamentos: cliente.lancamentos.map((item) => ({
          tipo: item.tipo,
          descricao: item.descricao,
          valor: item.valor.toFixed(2),
          data: paraDia(item.data),
          pagoEm: item.pagoEm ? paraDia(item.pagoEm) : null,
        })),
      };
    });
  }

  /**
   * Elimina os dados pessoais do cliente, mantendo o que a empresa precisa guardar.
   *
   * Anonimizar em vez de apagar: orçamentos e lançamentos continuam existindo
   * (faturamento, margem e obrigação fiscal dependem deles, art. 16, I), só que
   * ligados a um registro que não identifica mais ninguém.
   *
   * O histórico de auditoria é limpo junto. Ele guardava o cadastro inteiro em
   * `antes`/`depois`, e deixá-lo intacto seria anonimizar a ficha e manter a
   * cópia na tela ao lado.
   */
  async anonimizarCliente(clienteId: string): Promise<void> {
    await this.prisma.comTenant(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteId },
        select: {
          id: true,
          anonimizadoEm: true,
          posicaoFunil: { select: { id: true } },
          atendimentos: { select: { id: true } },
          orcamentos: { select: { id: true } },
          agendamentos: { select: { id: true } },
          lembretes: { select: { id: true } },
        },
      });

      if (!cliente) throw this.clienteNaoEncontrado();

      if (cliente.anonimizadoEm) {
        throw new ConflictException({
          codigo: CODIGOS_ERRO.CONFLITO,
          mensagem: 'Este cliente já foi anonimizado.',
        });
      }

      await tx.cliente.update({
        where: { id: clienteId },
        data: {
          nome: NOME_CLIENTE_ANONIMIZADO,
          email: null,
          telefone: null,
          documento: null,
          observacoes: null,
          camposPersonalizados: {},
          anonimizadoEm: new Date(),
        },
      });

      // Texto livre é onde o dado pessoal se esconde: "liguei para a Maria no
      // 11 9...". Valores, datas e status ficam; o que foi escrito sai.
      await tx.atendimento.updateMany({
        where: { clienteId },
        data: { descricao: TEXTO_REMOVIDO_LGPD },
      });
      await tx.orcamento.updateMany({ where: { clienteId }, data: { descricao: null } });
      await tx.agendamento.updateMany({ where: { clienteId }, data: { observacoes: null } });

      // Nenhum e-mail pode sair para quem pediu para ser esquecido.
      await tx.lembreteFollowUp.updateMany({
        where: { clienteId, status: 'pendente' },
        data: { status: 'cancelado' },
      });
      await tx.lembreteFollowUp.updateMany({ where: { clienteId }, data: { erro: null } });

      await tx.clienteFunil.deleteMany({ where: { clienteId } });

      const idsRelacionados = [
        cliente.id,
        ...(cliente.posicaoFunil ? [cliente.posicaoFunil.id] : []),
        ...cliente.atendimentos.map((item) => item.id),
        ...cliente.orcamentos.map((item) => item.id),
        ...cliente.agendamentos.map((item) => item.id),
        ...cliente.lembretes.map((item) => item.id),
      ];

      await tx.logAuditoria.updateMany({
        where: { entidadeId: { in: idsRelacionados } },
        data: { antes: Prisma.DbNull, depois: Prisma.DbNull, resumo: RESUMO_LOG_ANONIMIZADO },
      });

      await this.auditoria.registrar(tx, {
        entidade: 'cliente',
        entidadeId: clienteId,
        acao: 'anonimizou',
        resumo: RESUMO_LOG_ANONIMIZADO,
      });
    });
  }

  /** Cópia completa dos dados da empresa (portabilidade, art. 18, V). */
  async exportarEmpresa(): Promise<ExportacaoEmpresa> {
    return this.prisma.comTenant(async (tx) => {
      const [
        empresa,
        usuarios,
        clientes,
        etiquetas,
        clientesEtiquetas,
        camposPersonalizados,
        atendimentos,
        servicos,
        orcamentos,
        agendamentos,
        etapasFunil,
        clientesFunil,
        lembretes,
        categoriasFinanceiras,
        lancamentos,
        anexosLancamentos,
        proLabores,
        reservas,
        previsoesFinanceiras,
        historico,
      ] = await Promise.all([
        tx.tenant.findUniqueOrThrow({
          where: { id: tenantAtual() },
          select: {
            id: true,
            nome: true,
            cnpj: true,
            email: true,
            telefone: true,
            status: true,
            trialTerminaEm: true,
            ultimoPagamentoEm: true,
            criadoEm: true,
            plano: { select: { nome: true, slug: true } },
          },
        }),
        // Sem `senhaHash`: portabilidade é do dado, não da credencial.
        tx.usuario.findMany({
          select: {
            id: true,
            nome: true,
            email: true,
            papel: true,
            ativo: true,
            permissoes: true,
            ultimoLoginEm: true,
            criadoEm: true,
          },
        }),
        tx.cliente.findMany(),
        tx.etiqueta.findMany(),
        tx.clienteEtiqueta.findMany(),
        tx.campoPersonalizado.findMany(),
        tx.atendimento.findMany(),
        tx.servico.findMany(),
        tx.orcamento.findMany(),
        tx.agendamento.findMany(),
        tx.etapaFunil.findMany(),
        tx.clienteFunil.findMany(),
        tx.lembreteFollowUp.findMany(),
        tx.categoriaFinanceira.findMany(),
        tx.lancamentoFinanceiro.findMany(),
        // O conteúdo dos anexos fica de fora: cada um chega a 2 MB em base64, e
        // algumas dezenas deles estourariam a memória de uma resposta só.
        tx.anexoLancamento.findMany({ omit: { conteudo: true } }),
        tx.proLabore.findMany(),
        tx.reservaFinanceira.findMany(),
        tx.previsaoFinanceira.findMany(),
        tx.logAuditoria.findMany({ orderBy: { criadoEm: 'asc' } }),
      ]);

      await this.auditoria.registrar(tx, {
        entidade: 'empresa',
        entidadeId: tenantAtual(),
        acao: 'exportou',
        resumo: 'Cópia completa dos dados da empresa exportada.',
      });

      return {
        geradoEm: new Date().toISOString(),
        versao: 1,
        empresa,
        tabelas: {
          usuarios,
          clientes,
          etiquetas,
          clientesEtiquetas,
          camposPersonalizados,
          atendimentos,
          servicos,
          orcamentos,
          agendamentos,
          etapasFunil,
          clientesFunil,
          lembretes,
          categoriasFinanceiras,
          lancamentos,
          anexosLancamentos,
          proLabores,
          reservas,
          previsoesFinanceiras,
          historico,
        },
      };
    });
  }

  /**
   * Cancela a conta e agenda a exclusão dos dados.
   *
   * O acesso fecha na hora — `calcularAcesso` já recusa status `cancelado` no
   * login e na renovação —, mas os dados só somem depois do prazo publicado,
   * quem apaga é o `ExclusaoContasAgendador`. O intervalo existe para um
   * cancelamento por engano ainda ter volta pelo suporte.
   */
  async cancelarConta(dados: CancelamentoContaInput): Promise<ContaCancelada> {
    const { usuarioId } = exigirContextoTenant();

    const { empresa, usuario } = await this.prisma.comTenant(async (tx) => ({
      empresa: await tx.tenant.findUniqueOrThrow({
        where: { id: tenantAtual() },
        select: { nome: true, status: true },
      }),
      usuario: await tx.usuario.findUnique({
        where: { id: usuarioId },
        select: { senhaHash: true },
      }),
    }));

    if (empresa.status === 'cancelado') throw this.contaJaCancelada();

    if (normalizarNome(dados.nomeEmpresa) !== normalizarNome(empresa.nome)) {
      throw this.confirmacaoInvalida(
        'nomeEmpresa',
        'O nome digitado não confere com o da empresa.',
      );
    }

    // Fora da transação: o Argon2id leva centenas de milissegundos, e uma
    // conexão do pool presa esse tempo todo não compra nada.
    const senhaConfere = usuario
      ? await this.senhas.conferir(usuario.senhaHash, dados.senha)
      : false;

    // 400, e não 401: o frontend trata 401 como sessão encerrada e manda para
    // o login — errar a senha aqui não deveria derrubar quem está logado.
    if (!senhaConfere) {
      throw this.confirmacaoInvalida('senha', 'Senha incorreta.');
    }

    const canceladoEm = new Date();

    await this.prisma.comTenant(async (tx) => {
      await tx.$executeRaw`SELECT id FROM tenant WHERE id = ${tenantAtual()}::uuid FOR UPDATE`;

      const atual = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantAtual() },
        select: { status: true },
      });

      if (atual.status === 'cancelado') throw this.contaJaCancelada();

      await tx.tenant.update({
        where: { id: tenantAtual() },
        data: { status: 'cancelado', canceladoEm },
      });

      // Derruba todas as sessões da equipe: sem refresh token, cada navegador
      // aberto perde o acesso quando o access token expirar.
      await tx.refreshToken.deleteMany({});
      await tx.conviteEquipe.deleteMany({});
      await tx.lembreteFollowUp.updateMany({
        where: { status: 'pendente' },
        data: { status: 'cancelado' },
      });

      await this.auditoria.registrar(tx, {
        entidade: 'empresa',
        entidadeId: tenantAtual(),
        acao: 'cancelou',
        resumo: `Conta cancelada. Exclusão definitiva dos dados prevista para ${paraDia(
          calcularExclusaoPrevista(canceladoEm),
        )}.`,
      });
    });

    return {
      canceladoEm: canceladoEm.toISOString(),
      exclusaoPrevistaEm: paraDia(calcularExclusaoPrevista(canceladoEm)),
    };
  }

  private clienteNaoEncontrado(): NotFoundException {
    return new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Cliente não encontrado.',
    });
  }

  private contaJaCancelada(): ConflictException {
    return new ConflictException({
      codigo: CODIGOS_ERRO.CONFLITO,
      mensagem: 'Esta conta já foi cancelada.',
    });
  }

  private confirmacaoInvalida(campo: string, mensagem: string): BadRequestException {
    return new BadRequestException({
      codigo: CODIGOS_ERRO.VALIDACAO,
      mensagem,
      detalhes: { [campo]: [mensagem] },
    });
  }
}
