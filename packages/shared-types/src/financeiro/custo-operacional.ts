/**
 * Custo operacional diário (arquitetura §6, Fase B).
 *
 * Responde a uma pergunta que o fluxo de caixa não responde: **quanto este
 * negócio custa por dia só para existir**, sem vender nada. É o número que diz
 * quanto precisa entrar por dia para não haver prejuízo.
 *
 * ## A fórmula
 *
 *     custo operacional diário = custo fixo diário + pró-labore diário
 *
 * Entram os **custos fixos** e o **pró-labore vigente**. Ficam de fora os
 * custos variáveis, e isso é o ponto da conta: custo variável só existe porque
 * houve venda, então somá-lo faria o "custo de existir" subir justamente nos
 * meses bons — e o número perderia o sentido de ponto de equilíbrio.
 *
 * O pró-labore entra porque a retirada do dono existe mesmo num mês sem
 * venda. Um custo operacional que a ignora parece confortável e não cobre o
 * que a pessoa precisa tirar para viver.
 *
 * ## Por que os dois termos são divididos separadamente
 *
 * O custo fixo é um total **realizado no período** escolhido, então divide
 * pelos dias daquele período. O pró-labore é um valor **mensal vigente**, que
 * não depende do período consultado, então divide por um mês de referência.
 *
 * Misturar os dois numa única divisão exigiria proporcionalizar o pró-labore ao
 * período, o que dá o mesmo resultado com uma conta a mais para explicar. Aqui
 * cada parcela é conferível de cabeça, o que importa num número que alguém vai
 * usar para formar preço.
 */

/**
 * Mês de referência para diluir o pró-labore, em dias.
 *
 * Trinta, e não o número real de dias do mês, para o custo diário não oscilar
 * de fevereiro para março sem nada ter mudado no negócio.
 */
export const DIAS_DO_MES_REFERENCIA = 30;

export interface CustoOperacional {
  /** Custos fixos efetivamente pagos no período. */
  custoFixoPeriodo: string;
  /** Dias do período consultado, contando o primeiro e o último. */
  diasDoPeriodo: number;
  custoFixoDiario: string;

  /** Pró-labore mensal vigente hoje, ou `null` quando não há nenhum registrado. */
  proLaboreMensal: string | null;
  proLaboreDiario: string;

  /** A soma dos dois diários. */
  custoOperacionalDiario: string;

  periodo: { de: string; ate: string };
}
