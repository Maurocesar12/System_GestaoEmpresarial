import type { Metadata } from 'next';
import Link from 'next/link';
import type { Cliente, EtapaFunil, QuadroFunil } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioCliente } from '../formulario-cliente';
import { BotaoRemover } from './botao-remover';
import { EntrarNoFunil } from './entrar-no-funil';

export const metadata: Metadata = {
  title: 'Cliente — Gestão Empresarial',
};

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Ficha do cliente.
 *
 * Se o id for de outra empresa, a API responde 404 e esta página mostra o erro
 * padrão do Next — não há como espiar a carteira alheia trocando o id na URL.
 */
export default async function PaginaCliente({ params }: Props) {
  const { id } = await params;

  // As três consultas em paralelo: em sequência, a página esperaria a soma dos
  // tempos em vez do mais lento deles.
  const [cliente, etapas, quadro] = await Promise.all([
    apiComSessao<Cliente>(`/clientes/${id}`),
    apiComSessao<EtapaFunil[]>('/funil/etapas'),
    apiComSessao<QuadroFunil>('/funil'),
  ]);

  const etapaAtual =
    quadro.colunas.find((coluna) => coluna.clientes.some((c) => c.id === id))?.etapa.id ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/clientes"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Clientes
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{cliente.nome}</h1>

        <p className="text-muted-foreground text-sm">
          Cliente desde{' '}
          {new Date(cliente.criadoEm).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
      </div>

      <FormularioCliente cliente={cliente} />

      <EntrarNoFunil clienteId={cliente.id} etapas={etapas} etapaAtual={etapaAtual} />

      <section className="border-destructive/30 flex flex-col gap-3 rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Excluir cliente</h2>
          <p className="text-muted-foreground text-sm">
            Apaga também o histórico de atendimentos, orçamentos e agendamentos deste cliente. Não
            há como desfazer.
          </p>
        </div>

        <BotaoRemover id={cliente.id} nome={cliente.nome} />
      </section>
    </div>
  );
}
