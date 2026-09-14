import {
  AreaCarregando,
  Esqueleto,
  EsqueletoCabecalho,
  EsqueletoCartaoLista,
  EsqueletoIndicadores,
} from '@/components/ui/esqueleto';

/**
 * Carregamento do painel inicial.
 *
 * A silhueta é a mesma da tela pronta: cabeçalho, faixa de alertas, quatro
 * indicadores e os blocos em duas colunas. Quando os dados chegam, nada muda de
 * lugar.
 */
export default function CarregandoPainel() {
  return (
    <AreaCarregando rotulo="Carregando o painel">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Esqueleto className="h-16" />
          <Esqueleto className="h-16" />
          <Esqueleto className="h-16" />
        </div>

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
