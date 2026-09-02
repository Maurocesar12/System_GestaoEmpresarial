/**
 * Agrupa registros pelo dia, mantendo a ordem que a API já devolveu.
 *
 * A ordem importa: agenda e lembretes chegam ordenados cronologicamente pelo
 * banco, e reordenar aqui desfaria isso. O `Map` do JavaScript preserva a ordem
 * de inserção, então o primeiro dia visto continua sendo o primeiro grupo.
 *
 * O dia sai de um corte no texto ISO (`2026-08-13T14:30:00Z` → `2026-08-13`), e
 * não de um `Date`: converter passaria pelo fuso do servidor, e um compromisso
 * das 21h cairia no dia seguinte.
 */
export function agruparPorDia<T>(
  itens: T[],
  obterInstante: (item: T) => string,
): { dia: string; itens: T[] }[] {
  const grupos = new Map<string, T[]>();

  for (const item of itens) {
    const dia = obterInstante(item).slice(0, 10);

    const doDia = grupos.get(dia);
    if (doDia) {
      doDia.push(item);
    } else {
      grupos.set(dia, [item]);
    }
  }

  return [...grupos.entries()].map(([dia, doDia]) => ({ dia, itens: doDia }));
}
