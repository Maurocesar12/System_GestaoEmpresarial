import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  paginar,
  type Cliente,
  type ClienteFormInput,
  type ClienteIgnorado,
  type ClientesQuery,
  type MotivoIgnorado,
  type Paginado,
  type ResultadoImportacao,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { PrismaService, type TransacaoComTenant } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import type { Prisma } from '../../../generated/prisma/client';
import { FunilService } from '../funil/funil.service';
import { AuditoriaService } from '../../plataforma/auditoria/auditoria.service';

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
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(query: ClientesQuery): Promise<Paginado<Cliente>> {
    const where = this.montarFiltro(query.busca, query.origem);

    // As duas consultas na mesma transação, e não em sequência: se um cliente
    // for cadastrado entre elas, o total e a página devolvida ficariam
    // inconsistentes — a paginação mostraria "21 clientes" com 20 na lista.
    const [registros, total] = await this.prisma.comTenant((tx) =>
      Promise.all([
        tx.cliente.findMany({
          where,
          include: { etiquetas: { select: { etiquetaId: true } } },
          orderBy: { nome: 'asc' },
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.cliente.count({ where }),
      ]),
    );

    return paginar(
      registros.map((registro) => this.paraResposta(registro)),
      total,
      query,
    );
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
          etiquetas: { select: { etiquetaId: true } },
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
      await this.garantirLimiteClientes(tx);

      await this.garantirPersonalizacao(tx, dados);
      const criado = await tx.cliente.create({
        data: { id: uuidv7(), tenantId: tenantAtual(), ...this.paraBancoCliente(dados) },
        include: { etiquetas: { select: { etiquetaId: true } } },
      });

      await this.salvarEtiquetas(tx, criado.id, dados.etiquetas);

      // Todo cliente novo entra no funil, na primeira etapa. O cadastro é o
      // início da relação comercial, e um funil que só recebe quem alguém
      // lembrou de arrastar mostra menos do que a realidade.
      //
      // Na mesma transação: se a entrada no funil falhar, o cadastro é desfeito
      // junto — nada de cliente existindo pela metade.
      const etapa = await this.funil.colocarNaPrimeiraEtapa(tx, criado.id);

      await this.auditoria.registrar(tx, {
        entidade: 'cliente', entidadeId: criado.id, acao: 'criou', depois: this.paraResposta(criado),
      });

      return { cliente: criado, etapa };
    });

    // A etapa vai na resposta para o contrato ficar igual ao do `GET /clientes/:id`.
    // Sem isso, a tela precisaria de uma segunda requisição só para saber onde o
    // cliente caiu no funil.
    return { ...this.paraResposta(cliente), etiquetas: [...new Set(dados.etiquetas)], etapaFunil: etapa };
  }

  /**
   * Cria vários clientes de uma vez, a partir de uma planilha.
   *
   * ## Por que não é um laço chamando `criar()`
   *
   * `criar()` faz seis idas ao banco por cliente — trava do tenant, contagem do
   * limite, inserção, busca da primeira etapa, checagem de funil e inserção no
   * funil. Repetido 500 vezes seriam três mil consultas, e a transação ficaria
   * aberta tempo suficiente para segurar outras requisições da mesma empresa.
   *
   * Este método faz **seis consultas no total**, independente de o lote ter uma
   * linha ou quinhentas: trava, limite, busca de repetidos, inserção dos
   * clientes, busca da primeira etapa e inserção no funil.
   *
   * ## O que ele recusa e o que ele pula
   *
   * Estourar o limite do plano **falha o lote inteiro**, sem gravar nada:
   * importar 300 de 500 clientes e avisar depois deixaria o usuário sem saber
   * quais entraram. Já uma linha repetida apenas é pulada e volta na resposta
   * com o motivo — repetição é comum em planilha e não justifica descartar o
   * trabalho todo.
   */
  async importar(clientes: ClienteFormInput[]): Promise<ResultadoImportacao> {
    return this.prisma.comTenant(async (tx) => {
      await this.garantirLimiteClientes(tx, clientes.length);

      const ignorados: ClienteIgnorado[] = [];
      const aCriar: { indice: number; dados: ClienteFormInput }[] = [];

      // Repetições dentro do próprio arquivo, resolvidas em memória: a primeira
      // ocorrência entra, as seguintes são puladas.
      const documentosVistos = new Set<string>();
      const emailsVistos = new Set<string>();

      // Uma consulta só para descobrir o que já existe. Uma por linha
      // multiplicaria as idas ao banco pelo tamanho da planilha.
      const { documentos: documentosExistentes, emails: emailsExistentes } =
        await this.buscarRepetidos(tx, clientes);

      clientes.forEach((dados, indice) => {
        const motivo = this.motivoParaIgnorar(dados, {
          documentosExistentes,
          emailsExistentes,
          documentosVistos,
          emailsVistos,
        });

        if (motivo) {
          ignorados.push({ indice, nome: dados.nome, motivo });
          return;
        }

        if (dados.documento) documentosVistos.add(dados.documento);
        if (dados.email) emailsVistos.add(dados.email);

        aCriar.push({ indice, dados });
      });

      if (aCriar.length === 0) {
        return { criados: 0, ignorados };
      }

      // O id é gerado aqui, e não pelo banco, porque as linhas do funil
      // precisam apontar para esses clientes na mesma transação — sem os ids em
      // mãos, seria preciso reler o que acabou de ser inserido.
      const novos = aCriar.map(({ dados }) => ({
        id: uuidv7(),
        tenantId: tenantAtual(),
        ...this.paraBancoCliente(dados),
      }));

      await tx.cliente.createMany({ data: novos });

      await this.colocarLoteNoFunil(
        tx,
        novos.map((cliente) => cliente.id),
      );

      for (const novo of novos) {
        await this.auditoria.registrar(tx, {
          entidade: 'cliente', entidadeId: novo.id, acao: 'criou', depois: { ...novo },
        });
      }

      return { criados: novos.length, ignorados };
    });
  }

  async atualizar(id: string, dados: ClienteFormInput): Promise<Cliente> {
    const cliente = await this.prisma.comTenant(async (tx) => {
      // Confere a existência dentro do escopo do tenant antes de alterar: sem
      // isso, o `update` de um id de outra empresa falharia com erro cru do
      // Prisma em vez de um 404 limpo.
      //
      // Na mesma transação da escrita, e buscando só o `id`: chamar
      // `buscarPorId` aqui abriria uma segunda transação e ainda traria a
      // posição no funil junto, que não é usada para nada nesta conferência.
      const existe = await tx.cliente.findUnique({
        where: { id }, include: { etiquetas: { select: { etiquetaId: true } } },
      });

      if (!existe) {
        throw new NotFoundException({
          codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
          mensagem: 'Cliente não encontrado.',
        });
      }

      await this.garantirPersonalizacao(tx, dados);
      const alterado = await tx.cliente.update({
        where: { id }, data: this.paraBancoCliente(dados),
        include: { etiquetas: { select: { etiquetaId: true } } },
      });
      await this.salvarEtiquetas(tx, id, dados.etiquetas);
      await this.auditoria.registrar(tx, {
        entidade: 'cliente', entidadeId: id, acao: 'alterou',
        antes: this.paraResposta(existe), depois: this.paraResposta(alterado),
      });
      return alterado;
    });

    return { ...this.paraResposta(cliente), etiquetas: [...new Set(dados.etiquetas)] };
  }

  async remover(id: string): Promise<void> {
    // `deleteMany` em vez de `delete`: a RLS já garante o escopo, e assim uma
    // corrida (dois pedidos de exclusão ao mesmo tempo) não vira erro 500.
    // Contar o resultado dispensa a consulta prévia de existência.
    const { count } = await this.prisma.comTenant(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { id } });
      const resultado = await tx.cliente.deleteMany({ where: { id } });
      if (cliente && resultado.count) {
        await this.auditoria.registrar(tx, {
          entidade: 'cliente', entidadeId: id, acao: 'excluiu', antes: this.paraResposta(cliente),
        });
      }
      return resultado;
    });

    if (count === 0) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Cliente não encontrado.',
      });
    }
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
   * Confere se ainda cabem `quantidade` clientes no plano.
   *
   * Serve tanto ao cadastro individual ("cabe mais um?") quanto à importação
   * ("cabem mais trezentos?"). A mensagem muda com o caso: no lote ela diz
   * quantas vagas restam, porque "limite excedido" sem número deixa o usuário
   * adivinhando quantas linhas apagar da planilha.
   */
  private async garantirLimiteClientes(tx: TransacaoComTenant, quantidade = 1): Promise<void> {
    const tenantId = tenantAtual();

    // Serializa criações concorrentes do mesmo tenant: sem o lock, duas
    // requisições simultâneas poderiam contar "499" e ambas criar o cliente
    // número 500/501.
    await tx.$executeRaw`SELECT id FROM tenant WHERE id = ${tenantId}::uuid FOR UPDATE`;

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: { select: { limiteClientes: true, nome: true } } },
    });

    if (!tenant) {
      throw new NotFoundException({
        codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
        mensagem: 'Empresa não encontrada.',
      });
    }

    const limite = tenant.plano.limiteClientes;

    // Plano sem teto.
    if (limite === null) {
      return;
    }

    const total = await tx.cliente.count();
    const vagas = Math.max(limite - total, 0);

    if (quantidade > vagas) {
      throw new ForbiddenException({
        codigo: CODIGOS_ERRO.LIMITE_PLANO_EXCEDIDO,
        mensagem:
          quantidade === 1
            ? `O plano ${tenant.plano.nome} permite até ${limite} cliente(s). Faça upgrade para cadastrar mais.`
            : `O plano ${tenant.plano.nome} permite até ${limite} cliente(s) e ainda cabem ${vagas}. ` +
              `A planilha tem ${quantidade}. Nada foi importado.`,
      });
    }
  }

  /**
   * Documentos e e-mails que já existem entre os enviados.
   *
   * Consulta os dois campos de uma vez e devolve conjuntos, para a checagem por
   * linha custar O(1) em memória em vez de uma ida ao banco.
   */
  private async buscarRepetidos(
    tx: TransacaoComTenant,
    clientes: ClienteFormInput[],
  ): Promise<{ documentos: Set<string>; emails: Set<string> }> {
    const documentos = clientes
      .map((cliente) => cliente.documento)
      .filter((valor): valor is string => Boolean(valor));

    const emails = clientes
      .map((cliente) => cliente.email)
      .filter((valor): valor is string => Boolean(valor));

    if (documentos.length === 0 && emails.length === 0) {
      return { documentos: new Set(), emails: new Set() };
    }

    const existentes = await tx.cliente.findMany({
      where: {
        OR: [
          ...(documentos.length > 0 ? [{ documento: { in: documentos } }] : []),
          ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
        ],
      },
      select: { documento: true, email: true },
    });

    return {
      documentos: new Set(
        existentes.map((cliente) => cliente.documento).filter((valor) => valor !== null),
      ),
      emails: new Set(existentes.map((cliente) => cliente.email).filter((valor) => valor !== null)),
    };
  }

  /**
   * Decide se a linha deve ser pulada, e por quê.
   *
   * Cliente sem documento e sem e-mail nunca é considerado repetido: dois
   * homônimos são duas pessoas diferentes até prova em contrário, e recusá-los
   * pelo nome esconderia cadastros legítimos.
   */
  private motivoParaIgnorar(
    dados: ClienteFormInput,
    conjuntos: {
      documentosExistentes: Set<string>;
      emailsExistentes: Set<string>;
      documentosVistos: Set<string>;
      emailsVistos: Set<string>;
    },
  ): MotivoIgnorado | null {
    const { documento, email } = dados;

    if (documento && conjuntos.documentosVistos.has(documento)) return 'repetido_no_arquivo';
    if (email && conjuntos.emailsVistos.has(email)) return 'repetido_no_arquivo';
    if (documento && conjuntos.documentosExistentes.has(documento)) return 'documento_repetido';
    if (email && conjuntos.emailsExistentes.has(email)) return 'email_repetido';

    return null;
  }

  /**
   * Coloca o lote inteiro na primeira etapa do funil.
   *
   * Duas consultas para qualquer quantidade, contra duas **por cliente** se
   * `colocarNaPrimeiraEtapa` fosse chamado em laço. Os clientes acabaram de ser
   * criados nesta transação, então não há como já estarem no funil — a
   * verificação que a versão individual faz não é necessária aqui.
   */
  private async colocarLoteNoFunil(tx: TransacaoComTenant, clienteIds: string[]): Promise<void> {
    const primeira = await tx.etapaFunil.findFirst({
      orderBy: { ordem: 'asc' },
      select: { id: true },
    });

    // Empresa sem etapas simplesmente não tem funil; a importação não pode
    // falhar por isso.
    if (!primeira) {
      return;
    }

    await tx.clienteFunil.createMany({
      data: clienteIds.map((clienteId) => ({
        id: uuidv7(),
        tenantId: tenantAtual(),
        clienteId,
        etapaId: primeira.id,
      })),
    });
  }

  /**
   * Converte o registro do banco no formato da API.
   *
   * Datas viram string ISO: `Date` não sobrevive à serialização JSON de forma
   * previsível, e o frontend precisa de um formato estável para exibir.
   */
  private paraResposta(
    registro: Prisma.ClienteGetPayload<object> & { etiquetas?: Array<{ etiquetaId: string }> },
  ): Cliente {
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
      camposPersonalizados: registro.camposPersonalizados as Record<string, string>,
      etiquetas: registro.etiquetas?.map((item) => item.etiquetaId) ?? [],
      criadoEm: registro.criadoEm.toISOString(),
      atualizadoEm: registro.atualizadoEm.toISOString(),
    };
  }

  private paraBancoCliente(dados: ClienteFormInput) {
    const { etiquetas: _etiquetas, ...campos } = dados;
    return campos;
  }

  private async garantirPersonalizacao(tx: TransacaoComTenant, dados: ClienteFormInput): Promise<void> {
    const definicoes = await tx.campoPersonalizado.findMany();
    const porId = new Map(definicoes.map((item) => [item.id, item]));
    for (const [id, valor] of Object.entries(dados.camposPersonalizados)) {
      const campo = porId.get(id);
      if (!campo) throw new BadRequestException({ codigo: CODIGOS_ERRO.VALIDACAO, mensagem: 'Um campo personalizado não existe mais.' });
      if (valor && campo.tipo === 'numero' && !Number.isFinite(Number(valor.replace(',', '.')))) throw new BadRequestException({ codigo: CODIGOS_ERRO.VALIDACAO, mensagem: `${campo.nome} precisa ser um número.` });
      if (valor && campo.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new BadRequestException({ codigo: CODIGOS_ERRO.VALIDACAO, mensagem: `${campo.nome} precisa ser uma data válida.` });
      if (valor && campo.tipo === 'selecao' && !campo.opcoes.includes(valor)) throw new BadRequestException({ codigo: CODIGOS_ERRO.VALIDACAO, mensagem: `Escolha uma opção válida para ${campo.nome}.` });
    }
    const faltando = definicoes.find((item) => item.obrigatorio && !dados.camposPersonalizados[item.id]?.trim());
    if (faltando) throw new BadRequestException({ codigo: CODIGOS_ERRO.VALIDACAO, mensagem: `Preencha o campo obrigatório ${faltando.nome}.` });

    const ids = dados.etiquetas;
    if (!ids.length) return;
    const total = await tx.etiqueta.count({ where: { id: { in: ids } } });
    if (total !== new Set(ids).size) {
      throw new NotFoundException({ codigo: CODIGOS_ERRO.NAO_ENCONTRADO, mensagem: 'Uma das etiquetas não existe.' });
    }
  }

  private async salvarEtiquetas(tx: TransacaoComTenant, clienteId: string, ids: string[]): Promise<void> {
    await tx.clienteEtiqueta.deleteMany({ where: { clienteId } });
    if (ids.length) {
      await tx.clienteEtiqueta.createMany({
        data: [...new Set(ids)].map((etiquetaId) => ({ tenantId: tenantAtual(), clienteId, etiquetaId })),
      });
    }
  }
}
