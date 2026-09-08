import { formatarBRL, type FluxoDeCaixa } from '@gestao/shared-types';
import { Activity } from 'lucide-react';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';

const LARGURA = 780;
const ALTURA = 280;
const MARGEM = { topo: 18, direita: 22, baixo: 38, esquerda: 64 };

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

  const totalEntradas = pontos.reduce((total, item) => total + item.entradas, 0);
  const totalSaidas = pontos.reduce((total, item) => total + item.saidas, 0);
  const saldo = totalEntradas - totalSaidas;

  return (
    <Cartao>
      <CartaoCabecalho className="flex-wrap items-start">
        <div>
          <CartaoTitulo className="flex items-center gap-2">
            <Activity aria-hidden className="text-muted-foreground size-4" />
            Resumo dos últimos meses
          </CartaoTitulo>
          <p className="text-muted-foreground mt-1 text-xs">
            Entradas, saídas e saldo do caixa da empresa.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-4 text-right text-xs">
          <Resumo rotulo="Entradas" valor={totalEntradas} tom="text-sucesso" />
          <Resumo rotulo="Saídas" valor={totalSaidas} tom="text-destructive" />
          <Resumo
            rotulo="Saldo"
            valor={saldo}
            tom={saldo < 0 ? 'text-destructive' : 'text-sucesso'}
          />
        </div>
      </CartaoCabecalho>

      <CartaoConteudo className="pt-0">
        {pontos.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Nenhum lançamento financeiro para montar o resumo ainda.
          </p>
        ) : (
          <GraficoLinhas pontos={pontos} />
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

function GraficoLinhas({ pontos }: { pontos: PontoResumo[] }) {
  const valores = pontos.flatMap((item) => [item.entradas, item.saidas, item.saldo, 0]);
  const minimoBruto = Math.min(...valores);
  const maximoBruto = Math.max(...valores);
  const folga = Math.max((maximoBruto - minimoBruto) * 0.12, 1);
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3 text-[0.6875rem] text-muted-foreground">
        <Legenda classe="bg-grafico-1" rotulo="Entradas" />
        <Legenda classe="bg-grafico-3" rotulo="Saídas" />
        <Legenda classe="bg-grafico-2" rotulo="Saldo" />
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          role="img"
          aria-label="Gráfico de linhas com entradas, saídas e saldo dos últimos meses"
          className="min-w-[42rem]"
        >
          {marcacoes.map((valor) => {
            const posicaoY = y(valor);
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
                  x={MARGEM.esquerda - 8}
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
            y1={y(0)}
            y2={y(0)}
            className="stroke-muted-foreground/50"
            strokeWidth="1.25"
          />

          <Linha
            pontos={pontos}
            campo="entradas"
            classeLinha="stroke-grafico-1"
            classePonto="fill-grafico-1"
            x={x}
            y={y}
          />
          <Linha
            pontos={pontos}
            campo="saidas"
            classeLinha="stroke-grafico-3"
            classePonto="fill-grafico-3"
            x={x}
            y={y}
          />
          <Linha
            pontos={pontos}
            campo="saldo"
            classeLinha="stroke-grafico-2"
            classePonto="fill-grafico-2"
            x={x}
            y={y}
          />

          {pontos.map((item, indice) => (
            <text
              key={item.mes}
              x={x(indice)}
              y={ALTURA - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] capitalize"
            >
              {formatarMes(item.mes)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function Linha({
  pontos,
  campo,
  classeLinha,
  classePonto,
  x,
  y,
}: {
  pontos: PontoResumo[];
  campo: keyof Pick<PontoResumo, 'entradas' | 'saidas' | 'saldo'>;
  classeLinha: string;
  classePonto: string;
  x: (indice: number) => number;
  y: (valor: number) => number;
}) {
  const caminho = pontos
    .map((item, indice) => `${indice === 0 ? 'M' : 'L'} ${x(indice)} ${y(item[campo])}`)
    .join(' ');

  return (
    <>
      <path
        d={caminho}
        fill="none"
        className={`${classeLinha} grafico-linha-animada`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pontos.map((item, indice) => (
        <circle
          key={`${campo}-${item.mes}`}
          cx={x(indice)}
          cy={y(item[campo])}
          r="3.5"
          className={classePonto}
        >
          <title>
            {rotuloCampo(campo)} em {formatarMes(item.mes)}:{' '}
            {FORMATADOR_COMPACTO.format(item[campo])}
          </title>
        </circle>
      ))}
    </>
  );
}

function Resumo({ rotulo, valor, tom }: { rotulo: string; valor: number; tom: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 font-semibold tabular-nums ${tom}`}>{formatarBRL(valor.toFixed(2))}</p>
    </div>
  );
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
