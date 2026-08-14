import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type Cliente,
  type ClienteFormInput,
  type ClientesQuery,
  type Paginado,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';
import { FunilService } from '../funil/funil.service';

/**
 * Clientes da empresa.
 *
 * Nenhum método filtra por empresa explicitamente, e isso é o esperado: todo
 * acesso passa por `prisma.comTenant`, que define o tenant da sessão de banco
 * antes de qualquer consulta. O isolamento vem das três camadas descritas em
 * §4.2, não de um `where` que alguém precise lembrar de escrever.
 */
@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly funil: FunilService,
  ) {}

  async listar(query: ClientesQuery): Promise<Paginado<Cliente>> {
    const { pagina, porPagina, busca, origem } = query;

    const where = this.montarFiltro(busca, origem);

    // As duas consultas na mesma transação, e não em sequência: se um cliente
    // for cadastrado entre elas, o total e a página devolvida ficariam
    // inconsistentes — a paginação mostraria "21 clientes" com 20 na lista.
    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.cliente.findMany({
          where,
          orderBy: { nome: 'asc' },
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        tx.cliente.count({ where }),
      ]),
    );

    return {
      dados: registros.map((registro) => this.paraResposta(registro)),
      meta: {
        pagina,
        porPagina,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
      },
    };
  }

  async buscarPorId(id: string): Promise<Cliente> {
    const cliente = await this.prisma.comTenant((tx) =>
      tx.cliente.findUnique({
        where: { id },
        // A posição no funil vem junto, numa consulta só.
        //
        // Antes, a ficha do cliente baixava o **quadro inteiro** — todas as
        // etapas, todos os clientes, todos os orçamentos em aberto — apenas
        // para descobrir em qual coluna este cliente estava. Com cinquenta
        // clientes no funil, era uma consulta pesada para extrair um campo.
        include: {
          posicaoFunil: {
            select: { etapa: { select: { id: true, nome: true } } },
          },
        },
      }),
    );

    // Cliente de outra empresa cai aqui como "não encontrado", e não como "sem
    // permissão". A diferença importa: responder 403 confirmaria que aquele id
    // existe em algum lugar do sistema.
    if (!cliente) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Cliente não encontrado.',
      });
    }

    return {
      ...this.paraResposta(cliente),
      etapaFunil: cliente.posicaoFunil
        ? { id: cliente.posicaoFunil.etapa.id, nome: cliente.posicaoFunil.etapa.nome }
        : null,
    };
  }

  async criar(dados: ClienteFormInput): Promise<Cliente> {
    const { cliente, etapa } = await this.prisma.comTenant(async (tx) => {
      const criado = await tx.cliente.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...dados },
      });

      // Todo cliente novo entra no funil, na primeira etapa. O cadastro é o
      // início da relação comercial, e um funil que só recebe quem alguém
      // lembrou de arrastar mostra menos do que a realidade.
      //
      // Na mesma transação: se a entrada no funil falhar, o cadastro é desfeito
      // junto — nada de cliente existindo pela metade.
      const etapa = await this.funil.colocarNaPrimeiraEtapa(tx, criado.id);

      return { cliente: criado, etapa };
    });

    // A etapa vai na resposta para o contrato ficar igual ao do `GET /clientes/:id`.
    // Sem isso, a tela precisaria de uma segunda requisição só para saber onde o
    // cliente caiu no funil.
    return { ...this.paraResposta(cliente), etapaFunil: etapa };
  }

  async atualizar(id: string, dados: ClienteFormInput): Promise<Cliente> {
    // Confere a existência dentro do escopo do tenant antes de alterar: sem
    // isso, o `update` de um id de outra empresa falharia com erro cru do
    // Prisma em vez de um 404 limpo.
    await this.buscarPorId(id);

    const cliente = await this.prisma.comTenant((tx) =>
      tx.cliente.update({ where: { id }, data: dados }),
    );

    return this.paraResposta(cliente);
  }

  async remover(id: string): Promise<void> {
    await this.buscarPorId(id);

    // `deleteMany` em vez de `delete`: a RLS já garante o escopo, e assim uma
    // corrida (dois pedidos de exclusão ao mesmo tempo) não vira erro 500.
    await this.prisma.comTenant((tx) => tx.cliente.deleteMany({ where: { id } }));
  }

  /**
   * Monta o filtro de busca.
   *
   * A busca cobre nome, e-mail e telefone porque é assim que uma pessoa procura
   * um cliente no dia a dia — às vezes lembra o nome, às vezes só tem o número
   * que ligou. Os dígitos do telefone são extraídos para que "(11) 91234" ache
   * o registro guardado como "11912345678".
   */
  private montarFiltro(busca?: string, origem?: string): Prisma.ClienteWhereInput {
    const where: Prisma.ClienteWhereInput = {};

    if (origem) {
      where.origem = origem;
    }

    if (busca) {
      const digitos = busca.replace(/\D/g, '');

      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { email: { contains: busca, mode: 'insensitive' } },
        ...(digitos.length >= 3 ? [{ telefone: { contains: digitos } }] : []),
      ];
    }

    return where;
  }

  /**
   * Converte o registro do banco no formato da API.
   *
   * Datas viram string ISO: `Date` não sobrevive à serialização JSON de forma
   * previsível, e o frontend precisa de um formato estável para exibir.
   */
  private paraResposta(registro: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    documento: string | null;
    observacoes: string | null;
    origem: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    criadoEm: Date;
    atualizadoEm: Date;
  }): Cliente {
    return {
      id: registro.id,
      nome: registro.nome,
      email: registro.email,
      telefone: registro.telefone,
      documento: registro.documento,
      observacoes: registro.observacoes,
      origem: registro.origem,
      utmSource: registro.utmSource,
      utmMedium: registro.utmMedium,
      utmCampaign: registro.utmCampaign,
      criadoEm: registro.criadoEm.toISOString(),
      atualizadoEm: registro.atualizadoEm.toISOString(),
    };
  }
}
