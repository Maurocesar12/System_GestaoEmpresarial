import type { Metadata } from 'next';
import type { EquipeResponse } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { apiComSessao } from '@/lib/api-servidor';
import { GerenciadorEquipe } from './gerenciador-equipe';

export const metadata: Metadata = { title: 'Equipe' };

export default async function PaginaEquipe() {
  const equipe = await apiComSessao<EquipeResponse>('/equipe');
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Equipe"
        descricao="Convide funcionários e escolha exatamente o que cada pessoa pode fazer."
      />
      <GerenciadorEquipe {...equipe} />
    </div>
  );
}
