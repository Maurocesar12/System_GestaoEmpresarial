import {
  AreaCarregando,
  EsqueletoCabecalho,
  EsqueletoIndicadores,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

/**
 * Carregamento das recorrências.
 *
 * Quatro chamadas em paralelo: as recorrências, as categorias, os serviços e os
 * clientes — as três últimas alimentam os seletores do formulário de cadastro.
 */
export default function CarregandoRecorrencias() {
  return (
    <AreaCarregando rotulo="Carregando as recorrências">
      <div className="flex flex-col gap-8">
        <EsqueletoCabecalho comAcoes={false} />
        <EsqueletoIndicadores quantidade={3} />
        <EsqueletoTabela linhas={4} colunas={5} />
      </div>
    </AreaCarregando>
  );
}
