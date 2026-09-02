import { AreaCarregando, Esqueleto, EsqueletoCabecalho } from '@/components/ui/esqueleto';

/**
 * Carregamento do funil.
 *
 * A silhueta são as colunas do quadro. Rola na horizontal como o quadro real,
 * para a barra de rolagem não aparecer só depois que os dados chegam — o que
 * empurraria o conteúdo para cima no momento da troca.
 */
export default function CarregandoFunil() {
  return (
    <AreaCarregando rotulo="Carregando o funil">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />

        <div className="flex gap-3 overflow-x-auto pb-4">
          {Array.from({ length: 5 }, (_, coluna) => (
            <div key={coluna} className="flex w-[19rem] shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between">
                <Esqueleto className="h-4 w-28" />
                <Esqueleto className="h-4 w-8" />
              </div>

              {Array.from({ length: 3 - (coluna % 2) }, (_, cartao) => (
                <div
                  key={cartao}
                  className="bg-card flex flex-col gap-2 rounded-lg border p-3.5 shadow-[var(--sombra-sutil)]"
                >
                  <Esqueleto className="h-4 w-3/4" />
                  <Esqueleto className="h-3 w-1/2" />
                  <Esqueleto className="h-5 w-24" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AreaCarregando>
  );
}
