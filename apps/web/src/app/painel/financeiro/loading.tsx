import {
  AreaCarregando,
  EsqueletoCabecalho,
  EsqueletoIndicadores,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

/**
 * Carregamento do financeiro.
 *
 * Aparece só na navegação para a rota, enquanto o Next busca o conteúdo. Depois
 * que a página entra, quem espera a API é o `<Suspense>` de dentro dela — e aí
 * o cabeçalho real já está na tela, com os botões clicáveis.
 *
 * Por isso este esqueleto inclui o cabeçalho e o de lá não: são dois momentos
 * diferentes da mesma espera.
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
