import {
  AreaCarregando,
  Esqueleto,
  EsqueletoCabecalho,
  EsqueletoIndicadores,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

export default function CarregandoLeads() {
  return (
    <AreaCarregando rotulo="Carregando os leads">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />
        <EsqueletoIndicadores />
        {/* As duas barras de filtro: situação e período. */}
        <div className="flex flex-col gap-3">
          <Esqueleto className="h-9 w-full max-w-xl" />
          <Esqueleto className="h-9 w-full max-w-xs" />
        </div>
        <EsqueletoTabela linhas={8} colunas={6} />
      </div>
    </AreaCarregando>
  );
}
