import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import {
  ROTULO_STATUS,
  STATUS_ORCAMENTO,
  estaVencido,
  formatarBRL,
  type Orcamento,
  type Paginado,
  type ResumoOrcamentos,
  type StatusOrcamento,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraDeFiltros, FiltroLink } from '@/components/ui/filtro-link';
import { Indicador } from '@/components/ui/indicador';
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
import { AcoesStatus } from './acoes-status';

export const metadata: Metadata = {
  title: 'Orçamentos',
};

/**
 * O tom de cada status.
 *
 * Sai dos tokens de significado do sistema, e não de cores cruas do Tailwind:
 * é o que mantém "aguardando" com o mesmo âmbar aqui, no financeiro e na
 * agenda. Antes cada tela escolhia o seu, e as três já discordavam.
 */
const TOM_DO_STATUS: Record<StatusOrcamento, 'atencao' | 'sucesso' | 'perigo'> = {
  aberto: 'atencao',
  aprovado: 'sucesso',
  recusado: 'perigo',
};

interface Props {
  searchParams: Promise<{ status?: string; pagina?: string }>;
}

export default async function PaginaOrcamentos({ searchParams }: Props) {
  const { status, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '20' });
  if (status) query.set('status', status);

  const [lista, resumo] = await Promise.all([
    apiComSessao<Paginado<Orcamento>>(`/orcamentos?${query.toString()}`),
    apiComSessao<ResumoOrcamentos>('/orcamentos/resumo'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Orçamentos"
        descricao="Propostas enviadas e o que já foi respondido."
        acoes={
          <Link href="/painel/orcamentos/novo" className={estilosBotao()}>
            Novo orçamento
          </Link>
        }
      />

      {/* O resumo vem primeiro porque responde a pergunta mais frequente:
          quanto está em negociação e quanto já foi fechado. */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Indicador
          titulo="Em aberto"
          valor={formatarBRL(resumo.abertos.valor)}
          detalhe={rotularQuantidade(resumo.abertos.quantidade)}
          destaque
        />
        <Indicador
          titulo="Aprovados"
          valor={formatarBRL(resumo.aprovados.valor)}
          detalhe={rotularQuantidade(resumo.aprovados.quantidade)}
          tom="positivo"
        />
        <Indicador
          titulo="Recusados"
          valor={formatarBRL(resumo.recusados.valor)}
          detalhe={rotularQuantidade(resumo.recusados.quantidade)}
        />
      </section>

      <BarraDeFiltros rotulo="Filtrar por status">
        <FiltroLink base="/painel/orcamentos" parametro="status" atual={status} rotulo="Todos" />
        {STATUS_ORCAMENTO.map((valor) => (
          <FiltroLink
            key={valor}
            base="/painel/orcamentos"
            parametro="status"
            valor={valor}
            atual={status}
            rotulo={ROTULO_STATUS[valor]}
          />
        ))}
      </BarraDeFiltros>

      {lista.dados.length === 0 ? (
        <EstadoVazio
          icone={FileText}
          titulo="Nenhum orçamento por aqui"
          descricao={
            status
              ? 'Nenhum orçamento com este status.'
              : 'Emita o primeiro orçamento para acompanhar o que está em negociação.'
          }
          acao={
            status ? undefined : (
              <Link href="/painel/orcamentos/novo" className={estilosBotao({ tamanho: 'sm' })}>
                Novo orçamento
              </Link>
            )
          }
        />
      ) : (
        <Cartao>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Cliente</TabelaColuna>
              <TabelaColuna>Serviço</TabelaColuna>
              <TabelaColuna numerica>Valor</TabelaColuna>
              <TabelaColuna>Status</TabelaColuna>
              <TabelaColuna>Ações</TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {lista.dados.map((orcamento) => (
                <TabelaLinha key={orcamento.id}>
                  <TabelaCelula>
                    <Link
                      href={`/painel/orcamentos/${orcamento.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {orcamento.clienteNome}
                    </Link>
                  </TabelaCelula>

                  <TabelaCelula suave>{orcamento.servicoNome ?? '—'}</TabelaCelula>

                  {/* `tabular-nums` alinha os dígitos em coluna, o que torna a
                      comparação de valores possível de bater o olho. */}
                  <TabelaCelula numerica className="font-medium">
                    {formatarBRL(orcamento.valor)}
                  </TabelaCelula>

                  <TabelaCelula>
                    <span className="flex flex-col items-start gap-1">
                      <Selo tom={TOM_DO_STATUS[orcamento.status]}>
                        {ROTULO_STATUS[orcamento.status]}
                      </Selo>

                      {estaVencido(orcamento) && (
                        <span className="text-muted-foreground text-xs">validade expirada</span>
                      )}
                    </span>
                  </TabelaCelula>

                  <TabelaCelula>
                    <AcoesStatus id={orcamento.id} status={orcamento.status} />
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}
    </div>
  );
}

function rotularQuantidade(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'orçamento' : 'orçamentos'}`;
}
