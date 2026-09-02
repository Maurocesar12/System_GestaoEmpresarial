import {
  AreaCarregando,
  Esqueleto,
  EsqueletoCabecalho,
  EsqueletoTabela,
} from '@/components/ui/esqueleto';

export default function CarregandoClientes() {
  return (
    <AreaCarregando rotulo="Carregando os clientes">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />
        {/* O campo de busca. */}
        <Esqueleto className="h-10 w-full max-w-sm" />
        <EsqueletoTabela linhas={8} colunas={4} />
      </div>
    </AreaCarregando>
  );
}
