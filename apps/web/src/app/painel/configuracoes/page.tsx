import type { Metadata } from 'next';
import type { ConfiguracoesEmpresa } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioConfiguracoes } from './formulario-configuracoes';
export const metadata: Metadata = { title: 'Configurações' };
export default async function PaginaConfiguracoes() {
  const configuracoes = await apiComSessao<ConfiguracoesEmpresa>('/configuracoes');
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Dados, campos e etiquetas usados por toda a empresa."
      />
      <FormularioConfiguracoes iniciais={configuracoes} />
    </div>
  );
}
