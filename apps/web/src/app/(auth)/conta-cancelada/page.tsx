import type { Metadata } from 'next';
import Link from 'next/link';
import { DIAS_PARA_EXCLUIR_CONTA_CANCELADA } from '@gestao/shared-types';

export const metadata: Metadata = {
  title: 'Conta cancelada',
};

interface Props {
  searchParams: Promise<{ exclusao?: string }>;
}

export default async function PaginaContaCancelada({ searchParams }: Props) {
  const { exclusao } = await searchParams;
  const data =
    exclusao && /^\d{4}-\d{2}-\d{2}$/.test(exclusao)
      ? new Date(`${exclusao}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Conta cancelada</h1>
        <p className="text-muted-foreground text-sm">
          O acesso da sua equipe foi encerrado e os lembretes pendentes não serão enviados.
        </p>
      </header>

      <p className="text-sm leading-relaxed">
        {data
          ? `Todos os dados da empresa serão excluídos definitivamente em ${data}.`
          : `Todos os dados da empresa serão excluídos definitivamente em ${DIAS_PARA_EXCLUIR_CONTA_CANCELADA} dias.`}{' '}
        Até lá, se o cancelamento foi um engano, fale com o suporte.
      </p>

      <p className="text-muted-foreground text-sm">
        <Link href="/privacidade#retencao" className="text-foreground underline underline-offset-4">
          Veja a política de retenção de dados
        </Link>
      </p>
    </div>
  );
}
