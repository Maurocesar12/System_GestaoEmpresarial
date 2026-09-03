import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { mesCorrente } from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { ImportadorFinanceiro } from './importador-financeiro';

export const metadata: Metadata = { title: 'Dados financeiros' };

export default function PaginaDadosFinanceiros() {
  const periodo = mesCorrente();
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Importar e exportar"
        descricao="Transfira apenas lançamentos, contas e valores financeiros."
        voltar={{ href: '/painel/financeiro', rotulo: 'Financeiro' }}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Importar lançamentos</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <ImportadorFinanceiro />
          </CartaoConteudo>
        </Cartao>
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Exportar movimento</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo className="flex flex-col items-start gap-4">
            <p className="text-muted-foreground text-sm">
              Baixe as contas da empresa no período atual em CSV, compatível com Excel.
            </p>
            <a
              className={estilosBotao()}
              href={`/painel/financeiro/dados/exportar?de=${periodo.de}&ate=${periodo.ate}`}
            >
              <Download />
              Exportar mês atual
            </a>
          </CartaoConteudo>
        </Cartao>
      </div>
    </div>
  );
}
