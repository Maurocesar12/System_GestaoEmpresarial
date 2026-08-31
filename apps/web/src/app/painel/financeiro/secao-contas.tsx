import { AlertTriangle, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import {
  ROTULO_STATUS_LANCAMENTO,
  formatarBRL,
  type Lancamento,
  type ResumoContas,
} from '@gestao/shared-types';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Selo } from '@/components/ui/selo';
import { formatarDataCompleta } from '@/lib/formatacao';
import { AcoesBaixa } from './acoes-baixa';

/**
 * Contas a receber e a pagar.
 *
 * Fica **fora do filtro de período** de propósito, diferente do resto da tela.
 * Uma conta vencida em março continua sendo problema em agosto, e some se a
 * lista respeitar o mês corrente — que é exatamente o tipo de esquecimento que
 * este bloco existe para evitar.
 *
 * A ordem é atrasadas primeiro: é o que exige ação hoje.
 */
export function SecaoContas({ resumo, contas }: { resumo: ResumoContas; contas: Lancamento[] }) {
  const temVencido =
    Number(resumo.vencidoAReceber.total) > 0 || Number(resumo.vencidoAPagar.total) > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Contas em aberto</h2>
        <p className="text-muted-foreground text-xs">Independe do período selecionado acima.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCartao
          titulo="A receber"
          total={resumo.aReceber.total}
          quantidade={resumo.aReceber.quantidade}
        />
        <ResumoCartao
          titulo="Vencido a receber"
          total={resumo.vencidoAReceber.total}
          quantidade={resumo.vencidoAReceber.quantidade}
          alerta
        />
        <ResumoCartao
          titulo="A pagar"
          total={resumo.aPagar.total}
          quantidade={resumo.aPagar.quantidade}
        />
        <ResumoCartao
          titulo="Vencido a pagar"
          total={resumo.vencidoAPagar.total}
          quantidade={resumo.vencidoAPagar.quantidade}
          alerta
        />
      </div>

      {contas.length === 0 ? (
        <EstadoVazio
          icone={CalendarClock}
          titulo="Nada em aberto"
          descricao={
            temVencido
              ? 'As contas vencidas estão fora desta lista por já terem sido pagas.'
              : 'Ao lançar algo sem data de pagamento, ele aparece aqui até você dar baixa.'
          }
        />
      ) : (
        <Cartao className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {contas.map((conta) => (
                <tr key={conta.id} className="hover:bg-accent/40 transition-colors">
                  <td className="numerico text-muted-foreground px-4 py-3">
                    {conta.vencimento ? formatarDataCompleta(conta.vencimento) : 'sem prazo'}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/painel/financeiro/${conta.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {conta.descricao}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {conta.clienteNome ?? conta.servicoNome ?? 'Sem vínculo'}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <Selo tom={conta.status === 'atrasado' ? 'perigo' : 'atencao'} comPonto>
                      {ROTULO_STATUS_LANCAMENTO[conta.status]}
                    </Selo>
                  </td>

                  <td
                    className={`numerico px-4 py-3 text-right font-medium ${
                      conta.tipo === 'entrada' ? 'text-sucesso' : 'text-destructive'
                    }`}
                  >
                    {conta.tipo === 'saida' && '− '}
                    {formatarBRL(conta.valor)}
                  </td>

                  <td className="px-4 py-3">
                    <AcoesBaixa id={conta.id} status={conta.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      )}
    </section>
  );
}

function ResumoCartao({
  titulo,
  total,
  quantidade,
  alerta = false,
}: {
  titulo: string;
  total: string;
  quantidade: number;
  alerta?: boolean;
}) {
  // O destaque só aparece quando há valor vencido. Um cartão vermelho zerado
  // treina o olho a ignorar a cor justamente quando ela passa a importar.
  const emAlerta = alerta && Number(total) > 0;

  return (
    <Cartao className={emAlerta ? 'border-destructive/40' : undefined}>
      <div className="flex flex-col gap-1 p-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          {emAlerta && <AlertTriangle aria-hidden className="text-destructive size-3.5" />}
          {titulo}
        </p>

        <p className={`numerico text-2xl font-semibold ${emAlerta ? 'text-destructive' : ''}`}>
          {formatarBRL(total)}
        </p>

        <p className="text-muted-foreground text-xs">
          {quantidade === 1 ? '1 lançamento' : `${quantidade} lançamentos`}
        </p>
      </div>
    </Cartao>
  );
}
