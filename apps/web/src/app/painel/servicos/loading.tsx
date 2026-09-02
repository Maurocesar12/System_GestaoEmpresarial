import { AreaCarregando, EsqueletoCabecalho, EsqueletoTabela } from '@/components/ui/esqueleto';

export default function CarregandoServicos() {
  return (
    <AreaCarregando rotulo="Carregando os serviços">
      <div className="flex flex-col gap-6">
        <EsqueletoCabecalho />
        <EsqueletoTabela linhas={7} colunas={4} />
      </div>
    </AreaCarregando>
  );
}
