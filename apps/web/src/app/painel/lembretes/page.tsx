import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing } from 'lucide-react';
import {
  ROTULO_CANAL_LEMBRETE,
  ROTULO_STATUS_LEMBRETE,
  STATUS_LEMBRETE,
  formatarTelefone,
  type LembreteFollowUp,
  type Paginado,
  type StatusLembrete,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoItem, CartaoLista } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraDeFiltros, FiltroLink } from '@/components/ui/filtro-link';
import { Selo } from '@/components/ui/selo';
import { agruparPorDia } from '@/lib/agrupamento';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDiaAgenda, formatarHora } from '@/lib/formatacao';
import { AcoesLembrete } from './acoes-lembrete';

export const metadata: Metadata = {
  title: 'Lembretes',
};

/** Mesma escala de significado dos selos do resto do sistema. */
const TOM_DO_STATUS: Record<StatusLembrete, 'atencao' | 'sucesso' | 'perigo' | 'neutro'> = {
  pendente: 'atencao',
  enviado: 'sucesso',
  falhou: 'perigo',
  cancelado: 'neutro',
};

interface Props {
  searchParams: Promise<{ status?: string; pagina?: string }>;
}

export default async function PaginaLembretes({ searchParams }: Props) {
  const { status, pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '50' });
  if (status) query.set('status', status);

  const lembretes = await apiComSessao<Paginado<LembreteFollowUp>>(
    `/lembretes?${query.toString()}`,
  );

  const porDia = agruparPorDia(lembretes.dados, (lembrete) => lembrete.dataEnvio);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Lembretes"
        descricao={
          lembretes.meta.total === 0
            ? 'Nenhum follow-up agendado.'
            : `${lembretes.meta.total} ${lembretes.meta.total === 1 ? 'follow-up' : 'follow-ups'}.`
        }
        acoes={
          <Link href="/painel/lembretes/novo" className={estilosBotao()}>
            Novo lembrete
          </Link>
        }
      />

      <BarraDeFiltros rotulo="Filtrar por status">
        <FiltroLink base="/painel/lembretes" parametro="status" atual={status} rotulo="Todos" />
        {STATUS_LEMBRETE.map((valor) => (
          <FiltroLink
            key={valor}
            base="/painel/lembretes"
            parametro="status"
            valor={valor}
            atual={status}
            rotulo={ROTULO_STATUS_LEMBRETE[valor]}
          />
        ))}
      </BarraDeFiltros>

      {lembretes.dados.length === 0 ? (
        <EstadoVazio
          icone={BellRing}
          titulo="Sem lembretes"
          descricao="Crie follow-ups para não deixar retorno importante escapar."
          acao={
            status ? undefined : (
              <Link href="/painel/lembretes/novo" className={estilosBotao({ tamanho: 'sm' })}>
                Novo lembrete
              </Link>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {porDia.map(({ dia, itens }) => (
            <section key={dia} className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {formatarDiaAgenda(dia)}
              </h2>

              <Cartao>
                <CartaoLista>
                  {itens.map((lembrete) => {
                    const contato = contatoDoCliente(lembrete);

                    return (
                      <CartaoItem key={lembrete.id} className="flex-wrap items-start gap-4 p-4">
                        <div className="flex min-w-0 flex-1 gap-4">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatarHora(lembrete.dataEnvio)}
                          </span>

                          <div className="flex min-w-0 flex-col gap-1">
                            <Link
                              href={`/painel/clientes/${lembrete.clienteId}`}
                              className="truncate text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {lembrete.clienteNome}
                            </Link>

                            <span className="text-muted-foreground truncate text-xs">
                              {ROTULO_CANAL_LEMBRETE[lembrete.canal]}
                              {contato && ` · ${contato}`}
                            </span>

                            <Selo tom={TOM_DO_STATUS[lembrete.status]} className="w-fit">
                              {ROTULO_STATUS_LEMBRETE[lembrete.status]}
                            </Selo>
                          </div>
                        </div>

                        <AcoesLembrete id={lembrete.id} status={lembrete.status} />
                      </CartaoItem>
                    );
                  })}
                </CartaoLista>
              </Cartao>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function contatoDoCliente(lembrete: LembreteFollowUp): string | null {
  if (lembrete.canal === 'email') return lembrete.clienteEmail;
  return lembrete.clienteTelefone ? formatarTelefone(lembrete.clienteTelefone) : null;
}
