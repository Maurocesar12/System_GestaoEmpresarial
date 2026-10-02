import type { Metadata } from 'next';
import { formatarBRL, type RelatorioComissoes } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarPeriodo } from '@/lib/formatacao';
import { FiltrosComissoes, TabelaComissoes, lerFiltrosComissoes } from '../comissoes/componentes';

export const metadata: Metadata = { title: 'Minhas comissões' };

interface Props {
  searchParams: Promise<{ de?: string; ate?: string; status?: string }>;
}

/**
 * As comissões de quem está logado.
 *
 * A API decide de quem são pelo token; a tela não tem como pedir as de outra
 * pessoa. O percentual não aparece como cadastro, só aplicado em cada comissão.
 */
export default async function PaginaMinhasComissoes({ searchParams }: Props) {
  const { de: deUrl, ate: ateUrl, status: statusUrl } = await searchParams;
  const { query, status, filtrado } = lerFiltrosComissoes({
    de: deUrl,
    ate: ateUrl,
    status: statusUrl,
  });

  const relatorio = await apiComSessao<RelatorioComissoes>(`/comissoes/minhas?${query.toString()}`);

  // O período que a API usou (o mês corrente dela, sem datas na URL).
  const { de, ate } = relatorio.periodo;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Minhas comissões"
        descricao={`${formatarPeriodo(de, ate)} · das vendas aprovadas e dos serviços que você executou.`}
      />

      <FiltrosComissoes de={de} ate={ate} status={status} ativo={filtrado} />

      <FaixaDeIndicadores>
        <Indicador
          titulo="A receber"
          valor={formatarBRL(relatorio.totalPendente)}
          detalhe="ainda não fechadas pelo administrador"
          destaque
        />
        <Indicador
          titulo="Fechadas"
          valor={formatarBRL(relatorio.totalFechado)}
          detalhe="já lançadas para pagamento"
        />
      </FaixaDeIndicadores>

      <TabelaComissoes
        itens={relatorio.itens}
        mostrarPessoa={false}
        vazio="Suas comissões aparecem aqui quando um orçamento em que você é vendedor for aprovado ou um serviço em que você é técnico for executado."
      />
    </div>
  );
}
