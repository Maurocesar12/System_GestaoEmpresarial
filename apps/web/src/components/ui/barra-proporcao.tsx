import { cn } from '@/lib/utils';

interface Fatia {
  rotulo: string;
  /** Valor bruto. O componente calcula a proporção. */
  valor: number;
  /** Token de cor da série de gráficos: 1 a 5. */
  serie: 1 | 2 | 3 | 4 | 5;
}

const COR_DA_SERIE: Record<Fatia['serie'], string> = {
  1: 'bg-grafico-1',
  2: 'bg-grafico-2',
  3: 'bg-grafico-3',
  4: 'bg-grafico-4',
  5: 'bg-grafico-5',
};

/**
 * Composição de um total, numa barra só.
 *
 * Usada onde a pergunta é "quanto de cada", e não "quanto ao longo do tempo" —
 * custo fixo contra variável, por exemplo. Para duas ou três fatias isso lê
 * melhor que um gráfico de pizza, que obriga a comparar ângulos.
 *
 * ## Detalhes que a fazem funcionar
 *
 * As fatias são separadas por um vão de 2px na cor da superfície, e não
 * encostadas: sem o vão, duas cores vizinhas se fundem e a divisão some
 * justamente para quem tem dificuldade de distinguir aquelas duas cores.
 *
 * A legenda traz o quadradinho colorido **e** o rótulo escrito. Cor sozinha
 * nunca é o único sinal — e o valor vai escrito ao lado porque nenhuma barra
 * permite ler um número com precisão.
 */
export function BarraProporcao({
  fatias,
  formatar,
  className,
}: {
  fatias: Fatia[];
  /** Como escrever o valor na legenda. */
  formatar: (valor: number) => string;
  className?: string;
}) {
  const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);

  if (total <= 0) {
    return null;
  }

  const visiveis = fatias.filter((fatia) => fatia.valor > 0);

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {visiveis.map((fatia) => (
          <div
            key={fatia.rotulo}
            className={COR_DA_SERIE[fatia.serie]}
            style={{ width: `${(fatia.valor / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {visiveis.map((fatia) => (
          <li key={fatia.rotulo} className="flex items-center gap-1.5 text-xs">
            <span aria-hidden className={cn('size-2 rounded-full', COR_DA_SERIE[fatia.serie])} />
            <span className="text-muted-foreground">{fatia.rotulo}</span>
            <span className="font-medium tabular-nums">{formatar(fatia.valor)}</span>
            <span className="text-muted-foreground tabular-nums">
              {Math.round((fatia.valor / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Barra de magnitude dentro de uma célula de tabela.
 *
 * Uma série só, então não há identidade a codificar e a cor não carrega
 * significado — ela existe para o olho comparar comprimentos ao descer a
 * coluna, coisa que números sozinhos não permitem fazer rápido.
 *
 * O número continua escrito ao lado: a barra é apoio à leitura, nunca a
 * substitui.
 */
export function BarraMagnitude({
  valor,
  maximo,
  negativa = false,
}: {
  valor: number;
  maximo: number;
  negativa?: boolean;
}) {
  const proporcao = maximo > 0 ? Math.min(1, Math.abs(valor) / maximo) : 0;

  return (
    <span aria-hidden className="bg-muted block h-1.5 w-full overflow-hidden rounded-full">
      <span
        className={cn('block h-full rounded-full', negativa ? 'bg-destructive' : 'bg-grafico-1')}
        style={{ width: `${proporcao * 100}%` }}
      />
    </span>
  );
}
