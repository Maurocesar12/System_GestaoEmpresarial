import type { Metadata } from 'next';
import { formatarBRL, type ResumoReservas } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { apiComSessao } from '@/lib/api-servidor';
import { GerenciadorReservas } from './gerenciador-reservas';

export const metadata: Metadata = {
  title: 'Reservas',
};

/** Abaixo disto a empresa está exposta: um mês ruim já compromete a operação. */
const COBERTURA_CONFORTAVEL = 3;

/**
 * Reserva financeira.
 *
 * O saldo guardado é só metade da resposta. A outra metade — e a que muda o
 * comportamento de quem lê — é quantos meses de custo fixo aquilo cobre.
 * "R$ 18.000" não diz nada sozinho; "cobre 2,4 meses parado" diz tudo.
 */
export default async function PaginaReservas() {
  const resumo = await apiComSessao<ResumoReservas>('/financeiro/reservas');

  const cobertura = resumo.mesesDeCobertura;
  const confortavel = cobertura !== null && cobertura >= COBERTURA_CONFORTAVEL;

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Reservas"
        descricao="Quanto tempo a empresa aguenta se parar de faturar."
        voltar={{ href: '/painel/financeiro', rotulo: 'Financeiro' }}
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="Guardado"
          valor={formatarBRL(resumo.totalGuardado)}
          detalhe={
            resumo.reservas.length === 1 ? '1 reserva' : `${resumo.reservas.length} reservas`
          }
        />

        <Indicador
          titulo="Cobertura"
          valor={cobertura === null ? '—' : `${cobertura.toLocaleString('pt-BR')} meses`}
          tom={cobertura === null ? 'neutro' : confortavel ? 'positivo' : 'negativo'}
          detalhe={
            cobertura === null
              ? 'sem custo fixo registrado para comparar'
              : confortavel
                ? 'de custo fixo coberto'
                : `abaixo dos ${COBERTURA_CONFORTAVEL} meses recomendados`
          }
          destaque
        />

        <Indicador
          titulo="Custo fixo mensal"
          valor={formatarBRL(resumo.custoFixoMensal)}
          detalhe="média dos últimos 3 meses fechados"
        />

        <Indicador
          titulo="Soma das metas"
          valor={formatarBRL(resumo.totalDasMetas)}
          detalhe={
            Number(resumo.totalDasMetas) > 0
              ? `faltam ${formatarBRL(
                  Math.max(0, Number(resumo.totalDasMetas) - Number(resumo.totalGuardado)).toFixed(
                    2,
                  ),
                )}`
              : 'nenhuma meta definida'
          }
        />
      </FaixaDeIndicadores>

      <GerenciadorReservas reservas={resumo.reservas} />

      <section className="text-muted-foreground flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-foreground font-medium">Por que {COBERTURA_CONFORTAVEL} meses?</p>
        <p>
          É o tempo que costuma separar um susto de uma crise. Empresa de serviço raramente quebra
          por prejuízo — quebra por descasamento: um cliente grande atrasa, e a folha vence do mesmo
          jeito. Com três meses de custo fixo guardados, dá para atravessar isso sem antecipar
          recebível no banco.
        </p>
        <p>
          A cobertura usa o custo fixo, não o gasto total: o variável cai junto com o movimento, o
          fixo não.
        </p>
      </section>
    </div>
  );
}
