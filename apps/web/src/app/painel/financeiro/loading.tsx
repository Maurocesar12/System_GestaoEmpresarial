import {
  AreaCarregando,
  EsqueletoCabecalho,
  EsqueletoIndicadores,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

/**
 * Carregamento do financeiro.
 *
 * É a tela que mais espera: seis chamadas em paralelo (fluxo de caixa, margem,
 * lançamentos, resumo de contas e as duas listas de contas em aberto). Sem
 * esqueleto, é também a que mais parece travada.
 */
export default function CarregandoFinanceiro() {
  return (
    <AreaCarregando rotulo="Carregando o financeiro">
      <div className="flex flex-col gap-8">
        <EsqueletoCabecalho />
        <EsqueletoIndicadores />
        <EsqueletoIndicadores />
        <EsqueletoTabela linhas={5} colunas={5} />
        <EsqueletoTabela linhas={6} colunas={5} />
      </div>
    </AreaCarregando>
  );
}
