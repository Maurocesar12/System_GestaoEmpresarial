import {
  AreaCarregando,
  Esqueleto,
  EsqueletoCabecalho,
  EsqueletoCartaoLista,
} from '@/components/ui/esqueleto';

export default function CarregandoLembretes() {
  return (
    <AreaCarregando rotulo="Carregando os lembretes">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />

        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Esqueleto key={i} className="h-9 w-24" />
          ))}
        </div>

        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Esqueleto className="h-3 w-32" />
            <EsqueletoCartaoLista itens={3} />
          </div>
        ))}
      </div>
    </AreaCarregando>
  );
}
