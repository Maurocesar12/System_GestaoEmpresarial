import type { Metadata } from 'next';
import type { Lancamento, Paginado } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { apiComSessao } from '@/lib/api-servidor';
import { ConciliadorFinanceiro } from './conciliador-financeiro';

export const metadata: Metadata = {
  title: 'Conciliação financeira',
};

export default async function PaginaConciliacaoFinanceira() {
  const [atrasadas, aVencer] = await Promise.all([
    apiComSessao<Paginado<Lancamento>>(
      '/financeiro/lancamentos?status=atrasado&natureza=empresa&porPagina=100',
    ),
    apiComSessao<Paginado<Lancamento>>(
      '/financeiro/lancamentos?status=a_vencer&natureza=empresa&porPagina=100',
    ),
  ]);

  const contas = [...atrasadas.dados, ...aVencer.dados].sort((a, b) =>
    (a.vencimento ?? a.data).localeCompare(b.vencimento ?? b.data),
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Conciliação"
        descricao="Importe o extrato e vincule cada movimentação às contas em aberto."
        voltar={{ href: '/painel/financeiro', rotulo: 'Voltar ao financeiro' }}
      />

      <ConciliadorFinanceiro contas={contas} />
    </div>
  );
}
