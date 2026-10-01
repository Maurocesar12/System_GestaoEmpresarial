import type { ClientesService } from '../crm/clientes/clientes.service';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { MarketingService } from './marketing.service';

interface LeadFalso {
  id: string;
  criadoEm: string;
  origem?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

interface AprovadoFalso {
  clienteId: string;
  valor: string;
  /** Quando o orçamento foi aprovado. */
  aprovadoEm: string;
  /** Quando o cliente entrou — o outro lado do prazo até fechar. */
  clienteCriadoEm: string;
}

/**
 * Monta o serviço com um Prisma falso.
 *
 * As quatro consultas do relatório saem num `Promise.all`, então o falso
 * devolve as quatro na mesma ordem em que o serviço as pede.
 */
function montar(dados: {
  leads?: LeadFalso[];
  aprovados?: AprovadoFalso[];
  etapas?: { id: string; nome: string; ordem: number }[];
  noFunil?: { etapaId: string; total: number }[];
}) {
  const leads = (dados.leads ?? []).map((lead) => ({
    id: lead.id,
    criadoEm: new Date(lead.criadoEm),
    origem: lead.origem ?? null,
    utmSource: lead.utmSource ?? null,
    utmMedium: lead.utmMedium ?? null,
    utmCampaign: lead.utmCampaign ?? null,
  }));

  const aprovados = (dados.aprovados ?? []).map((orcamento) => ({
    clienteId: orcamento.clienteId,
    valor: new Prisma.Decimal(orcamento.valor),
    atualizadoEm: new Date(orcamento.aprovadoEm),
    cliente: { criadoEm: new Date(orcamento.clienteCriadoEm) },
  }));

  const prisma = {
    comTenant: (operacao: (tx: unknown) => unknown) =>
      operacao({
        cliente: { findMany: jest.fn().mockResolvedValue(leads) },
        orcamento: {
          findMany: jest
            .fn()
            .mockResolvedValue(
              [...aprovados].sort((a, b) => a.atualizadoEm.getTime() - b.atualizadoEm.getTime()),
            ),
        },
        etapaFunil: { findMany: jest.fn().mockResolvedValue(dados.etapas ?? []) },
        clienteFunil: {
          groupBy: jest.fn().mockResolvedValue(
            (dados.noFunil ?? []).map((grupo) => ({
              etapaId: grupo.etapaId,
              _count: { _all: grupo.total },
            })),
          ),
        },
      }),
  } as unknown as PrismaService;

  return new MarketingService(prisma, {} as ClientesService);
}

const PERIODO = { de: '2026-03-01', ate: '2026-03-31' };

describe('relatório de marketing', () => {
  describe('conversão por origem', () => {
    /**
     * O erro clássico deste relatório: contar linhas de orçamento em vez de
     * clientes. Dois orçamentos aprovados do mesmo cliente dariam 2 de 1 lead —
     * uma taxa de 200%.
     */
    it('conta o cliente uma vez, mesmo com dois orçamentos aprovados', async () => {
      const servico = montar({
        leads: [{ id: 'c1', criadoEm: '2026-03-10', origem: 'Indicação' }],
        aprovados: [
          {
            clienteId: 'c1',
            valor: '1000.00',
            aprovadoEm: '2026-03-15',
            clienteCriadoEm: '2026-03-10',
          },
          {
            clienteId: 'c1',
            valor: '500.00',
            aprovadoEm: '2026-03-20',
            clienteCriadoEm: '2026-03-10',
          },
        ],
      });

      const relatorio = await servico.relatorio(PERIODO);
      const indicacao = relatorio.origens[0]!;

      expect(indicacao.leads).toBe(1);
      expect(indicacao.convertidos).toBe(1);
      expect(indicacao.taxaConversao).toBe(1);
      // A receita, porém, soma os dois.
      expect(indicacao.receita).toBe('1500.00');
      expect(relatorio.totalConvertidos).toBe(1);
      expect(relatorio.receitaTotal).toBe('1500.00');
    });

    it('separa o balde de quem entrou sem origem', async () => {
      const servico = montar({
        leads: [
          { id: 'c1', criadoEm: '2026-03-02', origem: 'Instagram' },
          { id: 'c2', criadoEm: '2026-03-03', origem: null },
        ],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.origens.map((o) => o.origem)).toEqual(
        expect.arrayContaining(['Instagram', null]),
      );
      expect(relatorio.totalLeads).toBe(2);
    });

    it('usa o primeiro orçamento aprovado para o prazo até fechar', async () => {
      const servico = montar({
        leads: [{ id: 'c1', criadoEm: '2026-03-01', origem: 'Site' }],
        aprovados: [
          // Fora de ordem de propósito: o serviço ordena, e o prazo tem de sair
          // do mais antigo (5 dias), não do mais recente (20).
          {
            clienteId: 'c1',
            valor: '100.00',
            aprovadoEm: '2026-03-21',
            clienteCriadoEm: '2026-03-01',
          },
          {
            clienteId: 'c1',
            valor: '100.00',
            aprovadoEm: '2026-03-06',
            clienteCriadoEm: '2026-03-01',
          },
        ],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.origens[0]!.diasAteConversao).toBe(5);
    });

    // Zero dia significaria "fechou no mesmo dia", que é bem diferente de
    // "ainda não fechou ninguém".
    it('devolve null no prazo quando a origem não converteu', async () => {
      const servico = montar({
        leads: [{ id: 'c1', criadoEm: '2026-03-10', origem: 'Panfleto' }],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.origens[0]!.convertidos).toBe(0);
      expect(relatorio.origens[0]!.diasAteConversao).toBeNull();
    });
  });

  describe('campanhas', () => {
    /**
     * A mesma campanha em dois canais são dois investimentos.
     *
     * Agrupar só por `utmCampaign` somaria Google e Instagram e esconderia
     * qual dos dois vale continuar — que é a única decisão que esta tabela
     * existe para apoiar.
     */
    it('separa a mesma campanha rodando em fontes diferentes', async () => {
      const servico = montar({
        leads: [
          {
            id: 'c1',
            criadoEm: '2026-03-05',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'natal',
          },
          {
            id: 'c2',
            criadoEm: '2026-03-06',
            utmSource: 'instagram',
            utmMedium: 'cpc',
            utmCampaign: 'natal',
          },
          {
            id: 'c3',
            criadoEm: '2026-03-07',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'natal',
          },
        ],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.campanhas).toHaveLength(2);
      expect(relatorio.campanhas[0]).toMatchObject({
        utmSource: 'google',
        utmCampaign: 'natal',
        leads: 2,
      });
    });

    it('deixa de fora os leads sem nenhum UTM', async () => {
      const servico = montar({
        leads: [
          { id: 'c1', criadoEm: '2026-03-05', origem: 'Indicação' },
          { id: 'c2', criadoEm: '2026-03-06', utmSource: 'google' },
        ],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.campanhas).toHaveLength(1);
      expect(relatorio.campanhas[0]!.utmSource).toBe('google');
      // Mas ele continua contando no total de leads e na tabela de origens.
      expect(relatorio.totalLeads).toBe(2);
    });

    it('entra na lista com UTM parcial, sem confundir os campos vazios', async () => {
      const servico = montar({
        leads: [{ id: 'c1', criadoEm: '2026-03-05', utmCampaign: 'natal' }],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.campanhas[0]).toMatchObject({
        utmSource: null,
        utmMedium: null,
        utmCampaign: 'natal',
        leads: 1,
      });
    });
  });

  describe('série no tempo', () => {
    /**
     * A série existe para mostrar os dias vazios.
     *
     * Construída a partir dos leads, ela listaria só os dias com movimento — e
     * "não entrou ninguém na terça" é justamente o que o dono precisa ver.
     */
    it('inclui os dias sem nenhum lead', async () => {
      const servico = montar({
        leads: [{ id: 'c1', criadoEm: '2026-03-02', origem: 'Site' }],
      });

      const relatorio = await servico.relatorio({ de: '2026-03-01', ate: '2026-03-05' });

      expect(relatorio.serie.granularidade).toBe('dia');
      expect(relatorio.serie.pontos).toEqual([
        { quando: '2026-03-01', leads: 0, convertidos: 0 },
        { quando: '2026-03-02', leads: 1, convertidos: 0 },
        { quando: '2026-03-03', leads: 0, convertidos: 0 },
        { quando: '2026-03-04', leads: 0, convertidos: 0 },
        { quando: '2026-03-05', leads: 0, convertidos: 0 },
      ]);
    });

    it('marca no ponto quantos daqueles leads converteram', async () => {
      const servico = montar({
        leads: [
          { id: 'c1', criadoEm: '2026-03-02', origem: 'Site' },
          { id: 'c2', criadoEm: '2026-03-02', origem: 'Site' },
        ],
        aprovados: [
          {
            clienteId: 'c1',
            valor: '100.00',
            aprovadoEm: '2026-03-09',
            clienteCriadoEm: '2026-03-02',
          },
        ],
      });

      const relatorio = await servico.relatorio({ de: '2026-03-01', ate: '2026-03-03' });

      expect(relatorio.serie.pontos[1]).toEqual({
        quando: '2026-03-02',
        leads: 2,
        convertidos: 1,
      });
    });

    it('passa para meses quando o período é longo', async () => {
      const servico = montar({
        leads: [{ id: 'c1', criadoEm: '2026-02-14', origem: 'Site' }],
      });

      const relatorio = await servico.relatorio({ de: '2026-01-01', ate: '2026-06-30' });

      expect(relatorio.serie.granularidade).toBe('mes');
      expect(relatorio.serie.pontos.map((p) => p.quando)).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
      ]);
      expect(relatorio.serie.pontos[1]!.leads).toBe(1);
    });

    /**
     * O eixo mensal não pode pular mês.
     *
     * Partindo de 31 de janeiro, somar um mês daria 3 de março — fevereiro
     * desapareceria do eixo. O cursor vai para o dia 1 antes de avançar.
     */
    it('não perde fevereiro ao montar o eixo a partir do dia 31', async () => {
      const servico = montar({ leads: [] });

      const relatorio = await servico.relatorio({ de: '2026-01-31', ate: '2026-04-30' });

      expect(relatorio.serie.pontos.map((p) => p.quando)).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
      ]);
    });
  });

  describe('ocupação do funil', () => {
    /**
     * Etapa vazia continua na lista.
     *
     * Uma etapa que desaparece parece não existir, quando o que ela diz é
     * "ninguém do período chegou até aqui" — a informação mais útil da tabela.
     */
    it('lista as etapas sem lead do período com zero', async () => {
      const servico = montar({
        etapas: [
          { id: 'e1', nome: 'Novo', ordem: 1 },
          { id: 'e2', nome: 'Proposta', ordem: 2 },
          { id: 'e3', nome: 'Fechado', ordem: 3 },
        ],
        noFunil: [{ etapaId: 'e1', total: 4 }],
      });

      const relatorio = await servico.relatorio(PERIODO);

      expect(relatorio.etapas).toEqual([
        { etapaId: 'e1', etapa: 'Novo', ordem: 1, clientes: 4 },
        { etapaId: 'e2', etapa: 'Proposta', ordem: 2, clientes: 0 },
        { etapaId: 'e3', etapa: 'Fechado', ordem: 3, clientes: 0 },
      ]);
    });
  });
});
