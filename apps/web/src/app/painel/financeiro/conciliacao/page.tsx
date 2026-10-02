import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { ConciliadorFinanceiro } from './conciliador-financeiro';

export const metadata: Metadata = {
  title: 'Conciliação financeira',
};

/**
 * As contas em aberto não são carregadas aqui: a API as busca ao analisar o
 * extrato, já ordenadas pela semelhança com cada movimentação.
 */
export default function PaginaConciliacaoFinanceira() {
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Conciliação"
        descricao="Importe o extrato e vincule cada movimentação às contas em aberto."
        voltar={{ href: '/painel/financeiro', rotulo: 'Voltar ao financeiro' }}
      />

      <ConciliadorFinanceiro />
    </div>
  );
}
