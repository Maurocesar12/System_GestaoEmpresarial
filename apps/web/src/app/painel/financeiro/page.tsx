import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_NATUREZA,
  ROTULO_TIPO_LANCAMENTO,
  formatarBRL,
  mesCorrente,
  type FluxoDeCaixa,
  type Lancamento,
  type Paginado,
  type RelatorioMargem,
} from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = {
  title: 'Financeiro — Gestão Empresarial',
};

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

/**
 * Painel financeiro.
 *
 * Abre no mês corrente porque é o recorte que a pessoa quer em 90% das vezes —
 * um seletor de período vazio obrigaria a preencher duas datas antes de ver
 * qualquer coisa.
 *
 * A ordem responde: quanto entrou e saiu, o que dá lucro, e o que aconteceu.
 */
export default async function PaginaFinanceiro({ searchParams }: Props) {
  const parametros = await searchParams;
  const padrao = mesCorrente();
  const de = parametros.de ?? padrao.de;
  const ate = parametros.ate ?? padrao.ate;

  const periodo = `de=${de}&ate=${ate}`;

  const [fluxo, margem, lancamentos] = await Promise.all([
    apiComSessao<FluxoDeCaixa>(`/financeiro/fluxo-de-caixa?${periodo}`),
    apiComSessao<RelatorioMargem>(`/financeiro/margem?${periodo}`),
    apiComSessao<Paginado<Lancamento>>(`/financeiro/lancamentos?${periodo}&porPagina=20`),
  ]);

  const saldoNegativo = Number(fluxo.saldo) < 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground text-sm">
            {formatarPeriodo(de, ate)} · valores da empresa, sem os pessoais.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/painel/financeiro/categorias"
            className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
          >
            Categorias
          </Link>
          <Link
            href="/painel/financeiro/novo"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Novo lançamento
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Entradas" valor={fluxo.entradas} tom="positivo" />
        <Indicador titulo="Saídas" valor={fluxo.saidas} tom="negativo" />
        <Indicador
          titulo="Saldo"
          valor={fluxo.saldo}
          tom={saldoNegativo ? 'negativo' : 'positivo'}
          destaque
        />
        <Indicador
          titulo="Custo fixo"
          valor={fluxo.custoFixo}
          detalhe={`variável: ${formatarBRL(fluxo.custoVariavel)}`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Margem por serviço</h2>
          <p className="text-muted-foreground text-xs">
            Receita menos custo direto de cada serviço.
          </p>
        </div>

        {margem.itens.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Nenhum lançamento vinculado a serviço neste período. Vincule as entradas e saídas a um
            serviço para descobrir quais dão mais lucro.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Serviço</th>
                    <th className="px-4 py-3 text-right font-medium">Receita</th>
                    <th className="px-4 py-3 text-right font-medium">Custo</th>
                    <th className="px-4 py-3 text-right font-medium">Margem</th>
                    <th className="px-4 py-3 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {margem.itens.map((item) => (
                    <tr key={item.servicoId ?? 'sem'} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {item.servicoNome}
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          {item.quantidade}×
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatarBRL(item.receita)}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                        {formatarBRL(item.custo)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatarBRL(item.margem)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.margemPercentual === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              item.margemPercentual < 0
                                ? 'text-destructive font-medium'
                                : item.margemPercentual < 20
                                  ? 'font-medium text-amber-600 dark:text-amber-400'
                                  : 'font-medium text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {item.margemPercentual.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Receita sem serviço não some do relatório: uma lacuna visível é
                melhor que um número silenciosamente incompleto. */}
            {Number(margem.receitaSemServico) > 0 && (
              <p className="text-muted-foreground text-xs">
                {formatarBRL(margem.receitaSemServico)} de receita não está vinculada a nenhum
                serviço e ficou fora deste cálculo.
              </p>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Lançamentos do período</h2>

        {lancamentos.dados.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Nenhum lançamento neste período.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.dados.map((lancamento) => (
                  <tr key={lancamento.id} className="hover:bg-muted/30 border-t transition-colors">
                    <td className="text-muted-foreground px-4 py-3 tabular-nums">
                      {formatarData(lancamento.data)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/painel/financeiro/${lancamento.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {lancamento.descricao}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {lancamento.servicoNome ?? ROTULO_TIPO_LANCAMENTO[lancamento.tipo]}
                        {lancamento.natureza === 'pessoal' &&
                          ` · ${ROTULO_NATUREZA[lancamento.natureza]}`}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {lancamento.categoriaNome ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        lancamento.tipo === 'entrada'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      }`}
                    >
                      {lancamento.tipo === 'saida' && '− '}
                      {formatarBRL(lancamento.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  tom,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: 'positivo' | 'negativo';
  destaque?: boolean;
}) {
  const cor =
    tom === 'positivo'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tom === 'negativo'
        ? 'text-destructive'
        : '';

  return (
    <div className={`rounded-lg border p-4 ${destaque ? 'bg-muted/30' : ''}`}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${cor}`}>{formatarBRL(valor)}</p>
      {detalhe && <p className="text-muted-foreground text-xs">{detalhe}</p>}
    </div>
  );
}

/** Formata sem `new Date`, que leria a string como UTC e voltaria um dia. */
function formatarData(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

function formatarPeriodo(de: string, ate: string): string {
  const [anoDe, mesDe, diaDe] = de.split('-');
  const [anoAte, mesAte, diaAte] = ate.split('-');

  return `${diaDe}/${mesDe}/${anoDe} a ${diaAte}/${mesAte}/${anoAte}`;
}
