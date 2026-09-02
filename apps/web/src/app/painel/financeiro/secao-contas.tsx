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
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Selo } from '@/components/ui/selo';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
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

      <FaixaDeIndicadores>
        <ResumoDeContas titulo="A receber" dados={resumo.aReceber} />
        <ResumoDeContas titulo="Vencido a receber" dados={resumo.vencidoAReceber} alerta />
        <ResumoDeContas titulo="A pagar" dados={resumo.aPagar} />
        <ResumoDeContas titulo="Vencido a pagar" dados={resumo.vencidoAPagar} alerta />
      </FaixaDeIndicadores>

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
        <Cartao>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Vencimento</TabelaColuna>
              <TabelaColuna>Descrição</TabelaColuna>
              <TabelaColuna>Situação</TabelaColuna>
              <TabelaColuna numerica>Valor</TabelaColuna>
              <TabelaColuna numerica>
                <span className="sr-only">Ações</span>
              </TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {contas.map((conta) => (
                <TabelaLinha key={conta.id}>
                  <TabelaCelula suave className="tabular-nums whitespace-nowrap">
                    {conta.vencimento ? formatarDataCompleta(conta.vencimento) : 'sem prazo'}
                  </TabelaCelula>

                  <TabelaCelula className="min-w-[14rem]">
                    <Link
                      href={`/painel/financeiro/${conta.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {conta.descricao}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {conta.clienteNome ?? conta.servicoNome ?? 'Sem vínculo'}
                    </div>
                  </TabelaCelula>

                  <TabelaCelula>
                    <Selo tom={conta.status === 'atrasado' ? 'perigo' : 'atencao'} comPonto>
                      {ROTULO_STATUS_LANCAMENTO[conta.status]}
                    </Selo>
                  </TabelaCelula>

                  <TabelaCelula
                    numerica
                    className={
                      conta.tipo === 'entrada'
                        ? 'text-sucesso font-medium'
                        : 'text-destructive font-medium'
                    }
                  >
                    {conta.tipo === 'saida' && '− '}
                    {formatarBRL(conta.valor)}
                  </TabelaCelula>

                  <TabelaCelula>
                    <AcoesBaixa id={conta.id} status={conta.status} />
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}
    </section>
  );
}

/**
 * Um dos quatro números de contas em aberto.
 *
 * Usa o `Indicador` do sistema em vez de desenhar o próprio cartão — antes esta
 * seção reimplementava o componente inteiro e a faixa de grid, e as duas
 * versões já tinham espaçamentos diferentes.
 */
function ResumoDeContas({
  titulo,
  dados,
  alerta = false,
}: {
  titulo: string;
  dados: { total: string; quantidade: number };
  alerta?: boolean;
}) {
  // O destaque só aparece quando há valor vencido. Um cartão vermelho zerado
  // treina o olho a ignorar a cor justamente quando ela passa a importar.
  const emAlerta = alerta && Number(dados.total) > 0;

  return (
    <Indicador
      titulo={titulo}
      valor={formatarBRL(dados.total)}
      tom={emAlerta ? 'negativo' : 'neutro'}
      destaque={emAlerta}
      detalhe={
        <span className="flex items-center gap-1.5">
          {emAlerta && <AlertTriangle aria-hidden className="text-destructive size-3" />}
          {dados.quantidade === 1 ? '1 lançamento' : `${dados.quantidade} lançamentos`}
        </span>
      }
    />
  );
}
