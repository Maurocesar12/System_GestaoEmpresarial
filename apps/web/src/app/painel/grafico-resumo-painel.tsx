import { formatarBRL, type FluxoDeCaixa } from '@gestao/shared-types';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  WalletCards,
} from 'lucide-react';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';

const LARGURA = 860;
const ALTURA = 330;
const MARGEM = { topo: 30, direita: 34, baixo: 46, esquerda: 72 };

const FORMATADOR_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

interface PontoResumo {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export function GraficoResumoPainel({ fluxos }: { fluxos: FluxoDeCaixa[] }) {
  const pontos = fluxos.map((fluxo) => ({
    mes: fluxo.periodo.de.slice(0, 7),
    entradas: Number(fluxo.entradas),
    saidas: Number(fluxo.saidas),
    saldo: Number(fluxo.saldo),
  }));

  const totalEntradas = somar(pontos, 'entradas');
  const totalSaidas = somar(pontos, 'saidas');
  const saldo = totalEntradas - totalSaidas;
  const ultimo = pontos.at(-1);
  const anterior = pontos.at(-2);
  const variacaoSaldo = ultimo && anterior ? ultimo.saldo - anterior.saldo : 0;
  const mesMaisForte = pontos.reduce<PontoResumo | undefined>(
    (melhor, ponto) => (!melhor || ponto.saldo > melhor.saldo ? ponto : melhor),
    undefined,
  );
  const temMovimento = pontos.some((ponto) => ponto.entradas > 0 || ponto.saidas > 0);

  return (
    <Cartao className="overflow-hidden">
      <CartaoCabecalho className="items-start border-b-0 bg-muted/35 px-5 py-5">
        <div className="min-w-[16rem]">
          <CartaoTitulo className="flex items-center gap-2 text-base">
            <Activity aria-hidden className="text-primary size-5" />
            Resumo financeiro
          </CartaoTitulo>
          <p className="text-muted-foreground mt-1 text-sm">
            Leitura dos últimos 6 meses para entender caixa, ritmo e tendência ao entrar no painel.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Metrica
            icone={ArrowUpRight}
            rotulo="Entradas"
            valor={totalEntradas}
            tom="text-sucesso"
          />
          <Metrica
            icone={ArrowDownRight}
            rotulo="Saídas"
            valor={totalSaidas}
            tom="text-destructive"
          />
          <Metrica
            icone={WalletCards}
            rotulo="Saldo"
            valor={saldo}
            tom={saldo < 0 ? 'text-destructive' : 'text-sucesso'}
            destaque
          />
        </div>
      </CartaoCabecalho>

      <CartaoConteudo className="p-0">
        {!temMovimento ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
              <CircleDollarSign aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Resumo aguardando movimentação</p>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                Assim que houver lançamentos pagos, o painel mostra a evolução de entradas, saídas e
                saldo mês a mês.
              </p>
            </div>
          </div>
        ) : (
          <>
            <GraficoLinhas pontos={pontos} />
            <div className="grid gap-3 border-t bg-muted/20 p-4 md:grid-cols-3">
              <Insight
                rotulo="Último mês"
                valor={ultimo ? formatarBRL(ultimo.saldo.toFixed(2)) : 'Sem dados'}
                detalhe={ultimo ? `Saldo de ${formatarMesCompleto(ultimo.mes)}` : 'Sem movimento'}
                tom={ultimo && ultimo.saldo < 0 ? 'text-destructive' : 'text-sucesso'}
              />
              <Insight
                rotulo="Variação"
                valor={formatarBRL(variacaoSaldo.toFixed(2))}
                detalhe="Comparado ao mês anterior"
                tom={variacaoSaldo < 0 ? 'text-destructive' : 'text-sucesso'}
              />
              <Insight
                rotulo="Melhor mês"
                valor={mesMaisForte ? formatarBRL(mesMaisForte.saldo.toFixed(2)) : 'Sem dados'}
                detalhe={mesMaisForte ? formatarMesCompleto(mesMaisForte.mes) : 'Sem movimento'}
                tom="text-foreground"
              />
            </div>
          </>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

function GraficoLinhas({ pontos }: { pontos: PontoResumo[] }) {
  const escala = criarEscala(pontos);
  const caminhoEntradas = caminhoLinha(pontos, 'entradas', escala.x, escala.y);
  const caminhoSaidas = caminhoLinha(pontos, 'saidas', escala.x, escala.y);
  const caminhoSaldo = caminhoLinha(pontos, 'saldo', escala.x, escala.y);
  const areaSaldo = caminhoArea(pontos, 'saldo', escala.x, escala.y, escala.yZero);
  const ultimo = pontos.at(-1);
  const ultimoX = ultimo ? escala.x(pontos.length - 1) : 0;
  const ultimoY = ultimo ? escala.y(ultimo.saldo) : 0;

  return (
    <div className="px-4 pb-5 pt-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Evolução mensal</p>
          <p className="text-muted-foreground text-xs">
            O saldo mostra a diferença entre o que entrou e saiu em cada mês.
          </p>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-3 text-[0.6875rem]">
          <Legenda classe="bg-grafico-1" rotulo="Entradas" />
          <Legenda classe="bg-grafico-3" rotulo="Saídas" />
          <Legenda classe="bg-grafico-2" rotulo="Saldo" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          role="img"
          aria-label="Gráfico de linhas com entradas, saídas e saldo dos últimos seis meses"
          className="min-w-[46rem]"
        >
          <defs>
            <linearGradient id="area-saldo-painel" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                className="text-grafico-2"
                stopColor="currentColor"
                stopOpacity="0.2"
              />
              <stop
                offset="100%"
                className="text-grafico-2"
                stopColor="currentColor"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <rect
            x={MARGEM.esquerda}
            y={MARGEM.topo}
            width={escala.larguraUtil}
            height={escala.alturaUtil}
            rx="8"
            className="fill-muted/35"
          />

          {escala.marcacoes.map((valor) => {
            const posicaoY = escala.y(valor);
            return (
              <g key={valor}>
                <line
                  x1={MARGEM.esquerda}
                  x2={LARGURA - MARGEM.direita}
                  y1={posicaoY}
                  y2={posicaoY}
                  className="stroke-border"
                />
                <text
                  x={MARGEM.esquerda - 10}
                  y={posicaoY + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {FORMATADOR_COMPACTO.format(valor)}
                </text>
              </g>
            );
          })}

          <line
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={escala.yZero}
            y2={escala.yZero}
            className="stroke-muted-foreground/50"
            strokeWidth="1.25"
          />

          {pontos.map((item, indice) => (
            <g key={item.mes}>
              <line
                x1={escala.x(indice)}
                x2={escala.x(indice)}
                y1={MARGEM.topo}
                y2={ALTURA - MARGEM.baixo}
                className="stroke-border/60"
                strokeDasharray="4 8"
              />
              <text
                x={escala.x(indice)}
                y={ALTURA - 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] capitalize"
              >
                {formatarMes(item.mes)}
              </text>
            </g>
          ))}

          <path d={areaSaldo} className="grafico-area-animada" fill="url(#area-saldo-painel)" />
          <path
            d={caminhoEntradas}
            fill="none"
            className="stroke-grafico-1 grafico-linha-animada"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={caminhoSaidas}
            fill="none"
            className="stroke-grafico-3 grafico-linha-animada"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={caminhoSaldo}
            fill="none"
            className="stroke-grafico-2 grafico-linha-animada"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Pontos
            pontos={pontos}
            campo="entradas"
            classe="fill-grafico-1"
            x={escala.x}
            y={escala.y}
          />
          <Pontos
            pontos={pontos}
            campo="saidas"
            classe="fill-grafico-3"
            x={escala.x}
            y={escala.y}
          />
          <Pontos pontos={pontos} campo="saldo" classe="fill-grafico-2" x={escala.x} y={escala.y} />

          {ultimo && (
            <g>
              <line
                x1={ultimoX}
                x2={ultimoX}
                y1={ultimoY}
                y2={escala.yZero}
                className="stroke-grafico-2/50"
                strokeDasharray="4 6"
              />
              <circle
                cx={ultimoX}
                cy={ultimoY}
                r="7"
                className="fill-card stroke-grafico-2"
                strokeWidth="3"
              />
              <g
                transform={`translate(${Math.min(ultimoX + 14, LARGURA - 178)} ${Math.max(
                  ultimoY - 34,
                  18,
                )})`}
              >
                <rect width="164" height="38" rx="6" className="fill-card stroke-border" />
                <text x="10" y="15" className="fill-muted-foreground text-[10px]">
                  saldo do último mês
                </text>
                <text x="10" y="30" className="fill-foreground text-[12px] font-semibold">
                  {FORMATADOR_COMPACTO.format(ultimo.saldo)}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function Metrica({
  icone: Icone,
  rotulo,
  valor,
  tom,
  destaque = false,
}: {
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  rotulo: string;
  valor: number;
  tom: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`min-w-[9rem] rounded-md border bg-card px-3 py-2 shadow-[var(--sombra-sutil)] ${
        destaque ? 'border-primary/35' : ''
      }`}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icone aria-hidden className="size-3.5" />
        {rotulo}
      </div>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tom}`}>
        {formatarBRL(valor.toFixed(2))}
      </p>
    </div>
  );
}

function Insight({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  tom: string;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tom}`}>{valor}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{detalhe}</p>
    </div>
  );
}

function Pontos({
  pontos,
  campo,
  classe,
  x,
  y,
}: {
  pontos: PontoResumo[];
  campo: keyof Pick<PontoResumo, 'entradas' | 'saidas' | 'saldo'>;
  classe: string;
  x: (indice: number) => number;
  y: (valor: number) => number;
}) {
  return (
    <>
      {pontos.map((item, indice) => (
        <circle
          key={`${campo}-${item.mes}`}
          cx={x(indice)}
          cy={y(item[campo])}
          r="3.5"
          className={classe}
        >
          <title>
            {rotuloCampo(campo)} em {formatarMesCompleto(item.mes)}:{' '}
            {FORMATADOR_COMPACTO.format(item[campo])}
          </title>
        </circle>
      ))}
    </>
  );
}

function criarEscala(pontos: PontoResumo[]) {
  const valores = pontos.flatMap((item) => [item.entradas, item.saidas, item.saldo, 0]);
  const minimoBruto = Math.min(...valores);
  const maximoBruto = Math.max(...valores);
  const folga = Math.max((maximoBruto - minimoBruto) * 0.16, 1);
  const minimo = minimoBruto < 0 ? minimoBruto - folga : 0;
  const maximo = maximoBruto + folga;
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;
  const passoX = pontos.length === 1 ? 0 : larguraUtil / (pontos.length - 1);
  const x = (indice: number) =>
    pontos.length === 1 ? MARGEM.esquerda + larguraUtil / 2 : MARGEM.esquerda + passoX * indice;
  const y = (valor: number) =>
    MARGEM.topo + alturaUtil * (1 - (valor - minimo) / (maximo - minimo));
  const marcacoes = Array.from(
    { length: 5 },
    (_, indice) => minimo + ((maximo - minimo) * indice) / 4,
  );

  return { alturaUtil, larguraUtil, marcacoes, x, y, yZero: y(0) };
}

function caminhoLinha(
  pontos: PontoResumo[],
  campo: keyof Pick<PontoResumo, 'entradas' | 'saidas' | 'saldo'>,
  x: (indice: number) => number,
  y: (valor: number) => number,
): string {
  return pontos
    .map((item, indice) => `${indice === 0 ? 'M' : 'L'} ${x(indice)} ${y(item[campo])}`)
    .join(' ');
}

function caminhoArea(
  pontos: PontoResumo[],
  campo: keyof Pick<PontoResumo, 'entradas' | 'saidas' | 'saldo'>,
  x: (indice: number) => number,
  y: (valor: number) => number,
  yZero: number,
): string {
  const linha = caminhoLinha(pontos, campo, x, y);
  const ultimoX = x(pontos.length - 1);
  const primeiroX = x(0);
  return `${linha} L ${ultimoX} ${yZero} L ${primeiroX} ${yZero} Z`;
}

function somar(
  pontos: PontoResumo[],
  campo: keyof Pick<PontoResumo, 'entradas' | 'saidas' | 'saldo'>,
): number {
  return pontos.reduce((total, item) => total + item[campo], 0);
}

function Legenda({ classe, rotulo }: { classe: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${classe} h-0.5 w-4 rounded-full`} />
      {rotulo}
    </span>
  );
}

function rotuloCampo(campo: keyof Pick<PontoResumo, 'entradas' | 'saidas' | 'saldo'>): string {
  return { entradas: 'Entradas', saidas: 'Saídas', saldo: 'Saldo' }[campo];
}

function formatarMes(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatarMesCompleto(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
