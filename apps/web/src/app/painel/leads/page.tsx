import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox, MessageCircle, Phone } from 'lucide-react';
import {
  DIAS_LEAD_RECENTE,
  formatarBRL,
  formatarEspera,
  formatarTelefone,
  HORAS_LEAD_SEM_CONTATO,
  ROTULO_SITUACAO_LEAD,
  SITUACOES_LEAD,
  type EntradaDeLeads,
  type Lead,
  type SituacaoLead,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraDeFiltros } from '@/components/ui/filtro-link';
import { FiltroComposto } from '@/components/ui/filtro-composto';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Paginacao } from '@/components/ui/paginacao';
import { Selo } from '@/components/ui/selo';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';
import { linkTelefone, linkWhatsApp } from '@/lib/contato';
import { formatarDataCompleta } from '@/lib/formatacao';

export const metadata: Metadata = {
  title: 'Leads',
};

const BASE = '/painel/leads';

const JANELAS = [
  { valor: '7', rotulo: '7 dias' },
  { valor: String(DIAS_LEAD_RECENTE), rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
];

const TOM_DA_SITUACAO: Record<SituacaoLead, 'atencao' | 'info' | 'neutro' | 'sucesso'> = {
  aguardando: 'atencao',
  em_contato: 'info',
  com_proposta: 'neutro',
  ganho: 'sucesso',
};

interface Props {
  searchParams: Promise<{ situacao?: string; dias?: string; origem?: string; pagina?: string }>;
}

/**
 * Entrada de leads.
 *
 * A listagem de clientes ordena por nome e trata igual quem chegou hoje e quem
 * está na carteira há dois anos. Esta tela responde outra pergunta, que é a
 * primeira do dia de quem vende: **quem chegou e ainda não foi atendido?**
 *
 * A situação de cada lead é calculada pela API a partir do que existe pendurado
 * no cliente — atendimento, agendamento, proposta. Ninguém precisa marcar nada,
 * e é por isso que a fila não envelhece.
 */
export default async function PaginaLeads({ searchParams }: Props) {
  const { situacao, dias = String(DIAS_LEAD_RECENTE), origem, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '20', dias });
  if (situacao) query.set('situacao', situacao);
  if (origem) query.set('origem', origem);

  const { resumo, leads, meta } = await apiComSessao<EntradaDeLeads>(`/leads?${query.toString()}`);
  const filtros = { situacao, dias, origem };

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Leads"
        descricao="Quem chegou, em que pé está e quem ainda não recebeu contato."
        acoes={
          <Link href="/painel/clientes/novo" className={estilosBotao()}>
            Novo lead
          </Link>
        }
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="Hoje"
          valor={String(resumo.hoje)}
          detalhe={`${resumo.ontem} ontem · ${resumo.seteDias} em 7 dias`}
        />
        <Indicador
          titulo="Aguardando contato"
          valor={String(resumo.aguardandoContato)}
          detalhe={
            resumo.semContatoNoPrazo > 0
              ? `${resumo.semContatoNoPrazo} há mais de ${HORAS_LEAD_SEM_CONTATO} h`
              : 'todos dentro do prazo'
          }
          tom={resumo.semContatoNoPrazo > 0 ? 'negativo' : 'neutro'}
          href={`${BASE}?situacao=aguardando&dias=${dias}`}
        />
        <Indicador
          titulo="Em proposta"
          valor={formatarBRL(resumo.valorEmProposta)}
          detalhe={`${resumo.comProposta} lead(s) com orçamento aberto`}
          href={`${BASE}?situacao=com_proposta&dias=${dias}`}
        />
        <Indicador
          titulo="Convertidos"
          valor={`${Math.round(resumo.taxaConversao * 100)}%`}
          detalhe={`${resumo.ganhos} de ${resumo.noPeriodo} lead(s) no período`}
          tom={resumo.ganhos > 0 ? 'positivo' : 'neutro'}
        />
      </FaixaDeIndicadores>

      <div className="flex flex-col gap-3">
        <BarraDeFiltros rotulo="Situação do lead">
          <FiltroComposto
            base={BASE}
            parametros={filtros}
            parametro="situacao"
            atual={situacao}
            rotulo="Todos"
          />
          {SITUACOES_LEAD.map((valor) => (
            <FiltroComposto
              key={valor}
              base={BASE}
              parametros={filtros}
              parametro="situacao"
              valor={valor}
              atual={situacao}
              rotulo={ROTULO_SITUACAO_LEAD[valor]}
            />
          ))}
        </BarraDeFiltros>

        <BarraDeFiltros rotulo="Período de chegada">
          {JANELAS.map((janela) => (
            <FiltroComposto
              key={janela.valor}
              base={BASE}
              parametros={filtros}
              parametro="dias"
              valor={janela.valor}
              atual={dias}
              rotulo={janela.rotulo}
            />
          ))}
          {origem && (
            <FiltroComposto
              base={BASE}
              parametros={filtros}
              parametro="origem"
              atual={origem}
              rotulo={`Origem: ${origem} ✕`}
            />
          )}
        </BarraDeFiltros>
      </div>

      {resumo.porOrigem.length > 1 && (
        <ResumoPorOrigem origens={resumo.porOrigem} filtros={filtros} />
      )}

      {leads.length === 0 ? (
        <EstadoVazio
          icone={Inbox}
          titulo={situacao ? 'Nenhum lead nesta situação' : 'Nenhum lead no período'}
          descricao={
            situacao
              ? 'Troque o filtro para ver os outros leads que chegaram.'
              : 'Cadastre um cliente ou amplie a janela de dias para ver quem chegou antes.'
          }
          acao={
            <Link href="/painel/clientes/novo" className={estilosBotao({ variante: 'secundario' })}>
              Novo lead
            </Link>
          }
        />
      ) : (
        <Cartao>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Lead</TabelaColuna>
              <TabelaColuna>Origem</TabelaColuna>
              <TabelaColuna>Situação</TabelaColuna>
              <TabelaColuna>Chegou</TabelaColuna>
              <TabelaColuna numerica>Proposta</TabelaColuna>
              <TabelaColuna>
                <span className="sr-only">Contato</span>
              </TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {leads.map((lead) => (
                <LinhaDoLead key={lead.id} lead={lead} />
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}

      <Paginacao meta={meta} base={BASE} parametros={filtros} />
    </div>
  );
}

function LinhaDoLead({ lead }: { lead: Lead }) {
  const whatsapp = linkWhatsApp(lead.telefone);
  const telefone = linkTelefone(lead.telefone);
  const atrasado = lead.situacao === 'aguardando' && lead.horasAteContato >= HORAS_LEAD_SEM_CONTATO;

  return (
    <TabelaLinha>
      <TabelaCelula>
        <Link
          href={`/painel/clientes/${lead.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {lead.nome}
        </Link>
        <span className="text-muted-foreground block text-xs">
          {formatarTelefone(lead.telefone) || lead.email || 'sem contato cadastrado'}
        </span>
      </TabelaCelula>

      <TabelaCelula>
        <span className="text-sm">{lead.origem ?? '—'}</span>
        {lead.utmCampaign && (
          <span className="text-muted-foreground block text-xs">{lead.utmCampaign}</span>
        )}
      </TabelaCelula>

      <TabelaCelula>
        <Selo tom={TOM_DA_SITUACAO[lead.situacao]} comPonto>
          {ROTULO_SITUACAO_LEAD[lead.situacao]}
        </Selo>
      </TabelaCelula>

      <TabelaCelula>
        <span className="text-sm">{formatarDataCompleta(lead.criadoEm.slice(0, 10))}</span>
        <span
          className={`block text-xs ${atrasado ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
        >
          {lead.situacao === 'aguardando'
            ? `sem contato ${formatarEspera(lead.horasAteContato)}`
            : `primeiro contato ${formatarEspera(lead.horasAteContato)}`}
        </span>
      </TabelaCelula>

      <TabelaCelula numerica>
        {lead.orcamentoAberto ? (
          <Link
            href={`/painel/orcamentos/${lead.orcamentoAberto.id}`}
            className="font-medium tabular-nums underline-offset-4 hover:underline"
          >
            {formatarBRL(lead.orcamentoAberto.valor)}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TabelaCelula>

      <TabelaCelula>
        <div className="flex justify-end gap-1">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              aria-label={`Conversar com ${lead.nome} no WhatsApp`}
              className={estilosBotao({ variante: 'sutil', tamanho: 'icone' })}
            >
              <MessageCircle aria-hidden />
            </a>
          )}
          {telefone && (
            <a
              href={telefone}
              aria-label={`Ligar para ${lead.nome}`}
              className={estilosBotao({ variante: 'sutil', tamanho: 'icone' })}
            >
              <Phone aria-hidden />
            </a>
          )}
        </div>
      </TabelaCelula>
    </TabelaLinha>
  );
}

/**
 * De onde os leads vieram.
 *
 * Só aparece quando há mais de uma origem: com uma só, a lista repetiria o
 * total que já está no cabeçalho. Cada origem é um filtro — a pergunta que
 * vem depois de "de onde vieram?" é sempre "me mostra esses".
 */
function ResumoPorOrigem({
  origens,
  filtros,
}: {
  origens: Array<{ origem: string; total: number }>;
  filtros: Record<string, string | undefined>;
}) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>De onde vieram</CartaoTitulo>
        <span className="text-muted-foreground text-xs">no período filtrado</span>
      </CartaoCabecalho>

      <CartaoConteudo className="flex flex-wrap gap-2">
        {origens.map((item) => (
          <FiltroComposto
            key={item.origem}
            base={BASE}
            parametros={filtros}
            parametro="origem"
            valor={item.origem === 'Sem origem' ? undefined : item.origem}
            atual={filtros.origem}
            rotulo={`${item.origem} · ${item.total}`}
          />
        ))}
      </CartaoConteudo>
    </Cartao>
  );
}
