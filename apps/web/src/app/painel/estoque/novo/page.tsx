import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { FormularioMaterial } from '../formularios';

export const metadata: Metadata = { title: 'Novo material' };

export default function PaginaNovoMaterial() {
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Novo material"
        descricao="Depois de cadastrar, registre a primeira entrada com a quantidade e o custo."
        voltar={{ href: '/painel/estoque', rotulo: 'Estoque' }}
      />
      <FormularioMaterial />
    </div>
  );
}
