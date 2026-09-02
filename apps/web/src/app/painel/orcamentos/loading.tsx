import {
  AreaCarregando,
  Esqueleto,
  EsqueletoCabecalho,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

export default function CarregandoOrcamentos() {
  return (
    <AreaCarregando rotulo="Carregando os orçamentos">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />

        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 shadow-[var(--sombra-sutil)]">
              <Esqueleto className="h-3 w-20" />
              <Esqueleto className="mt-2 h-7 w-28" />
              <Esqueleto className="mt-1.5 h-3 w-24" />
            </div>
          ))}
        </div>

        {/* A barra de filtros por status. */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Esqueleto key={i} className="h-9 w-24" />
          ))}
        </div>

        <EsqueletoTabela linhas={6} colunas={5} />
      </div>
    </AreaCarregando>
  );
}
