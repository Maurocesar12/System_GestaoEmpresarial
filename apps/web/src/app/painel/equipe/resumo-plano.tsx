'use client';

import { formatarBRL, type EquipeResponse } from '@gestao/shared-types';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';

/** O resumo do plano e da cobrança de usuários, no topo da tela da equipe. */

export function ResumoPlano({ capacidade }: { capacidade: EquipeResponse['capacidade'] }) {
  const percentual = capacidade.percentualOcupado;

  return (
    <Cartao>
      <CartaoConteudo className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Plano da equipe
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{capacidade.planoNome}</h2>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  Nível {capacidade.planoNivel}
                </span>
                {capacidade.planoDestaque && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                    recomendado
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                {capacidade.planoDescricao}
              </p>
            </div>

            <div className="text-right">
              <p className="text-muted-foreground text-xs">Mensalidade estimada</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatarBRL(capacidade.mensalidadeEstimada)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricaPlano
              rotulo="Usuários ativos"
              valor={String(capacidade.usuariosAtivos)}
              detalhe={`${capacidade.usuariosInclusos ?? 'Todos'} incluídos`}
            />
            <MetricaPlano
              rotulo="Convites pendentes"
              valor={String(capacidade.convitesPendentes)}
              detalhe="Reservam vaga"
            />
            <MetricaPlano
              rotulo="Vagas disponíveis"
              valor={
                capacidade.vagasDisponiveis === null
                  ? 'Sem limite'
                  : String(capacidade.vagasDisponiveis)
              }
              detalhe={
                capacidade.limiteUsuarios === null
                  ? 'Sem teto definido'
                  : `${capacidade.vagasOcupadas}/${capacidade.limiteUsuarios} ocupadas`
              }
            />
          </div>

          {capacidade.limiteUsuarios !== null && (
            <div className="flex flex-col gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-[width]"
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Convites contam no limite para evitar vender mais acesso do que o plano permite.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <p className="text-sm font-semibold">Cobrança de usuários</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <ItemCobranca rotulo="Base" valor={formatarBRL(capacidade.precoBase)} />
            <ItemCobranca rotulo="Adicionais" valor={formatarBRL(capacidade.adicionalUsuarios)} />
            <ItemCobranca
              rotulo="Por adicional"
              valor={formatarBRL(capacidade.precoPorUsuarioAdicional)}
            />
            <ItemCobranca rotulo="Usuários extras" valor={String(capacidade.usuariosAdicionais)} />
          </dl>

          {capacidade.proximoPlano && (
            <div className="mt-4 rounded-md border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Próximo: {capacidade.proximoPlano.nome}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatarBRL(capacidade.proximoPlano.preco)}/mês · até{' '}
                    {capacidade.proximoPlano.limiteUsuarios ?? 'sem limite'} usuários
                  </p>
                </div>
                <ArrowUpRight className="text-muted-foreground size-4" />
              </div>
            </div>
          )}
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}

function MetricaPlano({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      <p className="text-muted-foreground mt-1 text-xs">{detalhe}</p>
    </div>
  );
}

function ItemCobranca({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{valor}</dd>
    </div>
  );
}
