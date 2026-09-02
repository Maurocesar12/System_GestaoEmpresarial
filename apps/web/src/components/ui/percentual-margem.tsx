/** Abaixo disto a margem merece atenção; abaixo de zero, o serviço dá prejuízo. */
const MARGEM_BAIXA = 20;

/**
 * Percentual de margem, colorido pelo que significa.
 *
 * A mesma escala vale no catálogo de serviços (margem planejada, do preço sobre
 * o custo) e no financeiro (margem realizada, do que de fato entrou e saiu).
 * Fica num lugar só porque o corte de "margem baixa" é uma regra de negócio: se
 * mudar de 20% para 25%, tem de mudar nas duas telas ao mesmo tempo, ou o mesmo
 * serviço aparece amarelo numa e verde na outra.
 *
 * Os tons saem dos tokens de significado, não de cores cruas do Tailwind — é o
 * que mantém "atenção" idêntico aqui e nos selos de status.
 */
export function PercentualMargem({ percentual }: { percentual: number | null }) {
  // `null` não é zero: é "não dá para calcular" — sem preço definido no
  // catálogo, ou sem receita no período. Mostrar 0% afirmaria algo falso.
  if (percentual === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const tom =
    percentual < 0
      ? 'text-destructive'
      : percentual < MARGEM_BAIXA
        ? 'text-atencao'
        : 'text-sucesso';

  return <span className={`font-medium ${tom}`}>{percentual.toFixed(0)}%</span>;
}
