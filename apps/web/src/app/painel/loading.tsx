import {
  AreaCarregando,
  EsqueletoCabecalho,
  EsqueletoCartaoLista,
  EsqueletoIndicadores,
} from '@/components/ui/esqueleto';

/**
 * Carregamento do painel inicial.
 *
 * A silhueta é a mesma da tela pronta: cabeçalho, quatro indicadores e quatro
 * blocos de lista em duas colunas. Quando os dados chegam, nada muda de lugar.
 */
export default function CarregandoPainel() {
  return (
    <AreaCarregando rotulo="Carregando o painel">
      <div className="flex flex-col gap-8">
        <EsqueletoCabecalho comAcoes={false} />
        <EsqueletoIndicadores />

        <div className="grid gap-4 lg:grid-cols-2">
          <EsqueletoCartaoLista />
          <EsqueletoCartaoLista />
          <EsqueletoCartaoLista />
          <EsqueletoCartaoLista />
        </div>
      </div>
    </AreaCarregando>
  );
}
