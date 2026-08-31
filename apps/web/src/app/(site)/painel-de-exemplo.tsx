/**
 * Prévia do produto exibida na abertura.
 *
 * É marcação de verdade, e não uma captura de tela. Três motivos: acompanha o
 * tema claro/escuro sozinha, continua nítida em qualquer densidade de tela e
 * não envelhece a cada ajuste de interface — o problema clássico do print
 * colado numa landing page.
 *
 * Os números são ilustrativos e existem só para dar forma ao componente.
 */

const INDICADORES = [
  { rotulo: 'Em negociação', valor: 'R$ 48.320', detalhe: '12 em aberto' },
  { rotulo: 'Fechado no mês', valor: 'R$ 21.900', detalhe: '7 aprovados' },
];

const COMPROMISSOS = [
  { cliente: 'Maria Souza', servico: 'Instalação de ar-condicionado', quando: 'hoje, 14:00' },
  { cliente: 'Carlos Lima', servico: 'Manutenção preventiva', quando: 'amanhã, 09:30' },
  { cliente: 'Ana Prado', servico: 'Visita técnica', quando: 'sexta, 16:00' },
];

/** Altura relativa das barras, em porcentagem. Só forma, nenhum dado real. */
const BARRAS = [42, 58, 35, 71, 64, 88];

export function PainelDeExemplo() {
  return (
    <div
      // Some de leitores de tela: é ilustração. O conteúdo textual da página já
      // explica o produto, e ouvir "R$ 48.320" fora de contexto só confundiria.
      aria-hidden
      className="bg-card overflow-hidden rounded-xl border shadow-[var(--sombra-media)]"
    >
      <div className="bg-superficie flex items-center gap-1.5 border-b px-4 py-2.5">
        <span className="bg-muted-foreground/30 size-2 rounded-full" />
        <span className="bg-muted-foreground/30 size-2 rounded-full" />
        <span className="bg-muted-foreground/30 size-2 rounded-full" />
        <span className="text-muted-foreground ml-2 text-xs">Painel · Oficina do João</span>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          {INDICADORES.map((indicador) => (
            <div key={indicador.rotulo} className="rounded-lg border p-3">
              <p className="text-muted-foreground text-[0.625rem] font-medium tracking-wide uppercase">
                {indicador.rotulo}
              </p>
              <p className="numerico mt-1 text-xl font-semibold tracking-tight">
                {indicador.valor}
              </p>
              <p className="text-muted-foreground text-[0.6875rem]">{indicador.detalhe}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium">Faturamento por semana</p>
            <p className="text-muted-foreground text-[0.6875rem]">últimos 6</p>
          </div>

          <div className="mt-3 flex h-16 items-end gap-1.5">
            {BARRAS.map((altura, indice) => (
              <div
                key={indice}
                style={{ height: `${altura}%` }}
                className={
                  indice === BARRAS.length - 1
                    ? 'bg-primary flex-1 rounded-sm'
                    : 'bg-primary/25 flex-1 rounded-sm'
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium">Próximos compromissos</p>

          <ul className="divide-y">
            {COMPROMISSOS.map((compromisso) => (
              <li
                key={compromisso.cliente}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium">{compromisso.cliente}</span>
                  <span className="text-muted-foreground truncate text-[0.6875rem]">
                    {compromisso.servico}
                  </span>
                </div>
                <span className="text-muted-foreground numerico shrink-0 text-[0.6875rem]">
                  {compromisso.quando}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
