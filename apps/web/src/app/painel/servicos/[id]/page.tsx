import type { Metadata } from 'next';
import Link from 'next/link';
import type { Servico } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { FormularioServico } from '../formulario-servico';
import { BotaoDesativar } from './botao-desativar';

export const metadata: Metadata = {
  title: 'Serviço',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaServico({ params }: Props) {
  const { id } = await params;
  const servico = await apiComSessao<Servico>(`/servicos/${id}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/servicos"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Serviços
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{servico.nome}</h1>

        {!servico.ativo && (
          <p className="text-muted-foreground text-sm">
            Este serviço está desativado. Ele não aparece em orçamentos novos, mas continua no
            histórico.
          </p>
        )}
      </div>

      <FormularioServico servico={servico} />

      {servico.ativo && (
        <section className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Desativar serviço</h2>
            <p className="text-muted-foreground text-sm">
              Ele some das listas de orçamento, mas continua visível nos registros antigos. Nada é
              apagado — o relatório de margem dos meses anteriores permanece correto.
            </p>
          </div>

          <BotaoDesativar id={servico.id} />
        </section>
      )}
    </div>
  );
}
