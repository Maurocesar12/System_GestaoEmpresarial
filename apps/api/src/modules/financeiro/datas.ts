/**
 * Conversões entre a data pura do banco (`DATE`) e o texto `AAAA-MM-DD` que
 * trafega no JSON.
 *
 * Ficam fora do serviço porque os três módulos do financeiro — lançamentos,
 * pró-labore e reservas — precisam exatamente das mesmas regras, e uma cópia
 * divergente aqui move um valor de mês.
 */

/** Coluna `DATE` do banco para `AAAA-MM-DD`, preservando o nulo. */
export function paraDia(valor: Date | null): string | null {
  return valor ? valor.toISOString().slice(0, 10) : null;
}

/** `AAAA-MM-DD` para o `DATE` do banco, fixado em meia-noite UTC. */
export function paraData(dia: string | null | undefined): Date | null {
  return dia ? new Date(`${dia}T00:00:00Z`) : null;
}

/**
 * Hoje em `AAAA-MM-DD`, no fuso de Brasília.
 *
 * Não usa a data do servidor direto: em produção ele roda em UTC, e das 21h à
 * meia-noite o UTC já está no dia seguinte. Uma conta venceria — e apareceria
 * como atrasada para o usuário — três horas antes de vencer de verdade.
 */
export function hojeEmDia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * O primeiro dia do mês que começou `quantos` meses atrás.
 *
 * Base das médias mensais: a janela sempre começa no dia 1, para que um mês não
 * entre pela metade e puxe a média para baixo.
 */
export function primeiroDiaDeMesesAtras(quantos: number, hoje = hojeEmDia()): string {
  const [ano, mes] = hoje.split('-').map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1 - quantos, 1));

  return data.toISOString().slice(0, 10);
}

/**
 * Quantos meses a janela `de`–`ate` cobre, contando o primeiro e o último.
 *
 * Conta meses do calendário, não dias: de 15/01 a 03/03 são três meses
 * tocados. É o divisor das médias mensais, e é por isso que ele não pode ser o
 * tamanho pedido da janela — uma empresa aberta há um mês, dividida por três,
 * teria a receita média subestimada em dois terços e um teto de pró-labore
 * artificialmente baixo.
 *
 * Devolve zero quando `ate` é anterior a `de`, o que acontece quando a empresa
 * só tem movimento no mês corrente (a janela fecha no mês passado).
 */
export function mesesEntre(de: string, ate: string): number {
  const [anoDe, mesDe] = de.split('-').map(Number);
  const [anoAte, mesAte] = ate.split('-').map(Number);

  const meses = (anoAte! - anoDe!) * 12 + (mesAte! - mesDe!) + 1;

  return Math.max(0, meses);
}

/** O último dia do mês anterior ao corrente — o fim da janela de médias. */
export function ultimoDiaDoMesPassado(hoje = hojeEmDia()): string {
  const [ano, mes] = hoje.split('-').map(Number);

  // Dia zero de um mês é o último dia do mês anterior; acerta fevereiro
  // bissexto sem tabela de dias.
  return new Date(Date.UTC(ano!, mes! - 1, 0)).toISOString().slice(0, 10);
}
