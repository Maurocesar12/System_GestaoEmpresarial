import {
  AreaCarregando,
  Esqueleto,
  EsqueletoCabecalho,
  EsqueletoIndicadores,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

export default function CarregandoReativacao() {
  return (
    <AreaCarregando rotulo="Carregando a lista de reativação">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho comAcoes={false} />
        <EsqueletoIndicadores />
        <div className="flex flex-col gap-3">
          <Esqueleto className="h-9 w-full max-w-2xl" />
          <Esqueleto className="h-9 w-full max-w-sm" />
        </div>
        <EsqueletoTabela linhas={8} colunas={6} />
      </div>
    </AreaCarregando>
  );
}
