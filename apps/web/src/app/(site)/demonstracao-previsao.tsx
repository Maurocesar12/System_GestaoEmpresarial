import { AlertTriangle, CheckCircle2, Lock, PenLine, Sigma, UserCheck } from 'lucide-react';
import styles from './demonstracao-previsao.module.css';

/**
 * Demonstração da previsão financeira com IA.
 *
 * ## O que esta peça precisa comunicar
 *
 * Que a parte difícil **não** é a IA. O número sai da contabilidade do próprio
 * sistema — entradas recebidas, saídas pagas, contas já registradas. A IA
 * entra depois, para ler esse cenário e dizer o que fazer. Confundir as duas
 * coisas é o que faz o dono desconfiar do resultado ("a máquina inventou") ou
 * confiar demais ("a máquina garantiu").
 *
 * Por isso a tela tem um gráfico só, e ao lado dele os quatro passos do
 * caminho, com a fronteira dos dados explícita: nome de cliente não sai daqui.
 *
 * ## Sem JavaScript
 *
 * A troca de cenário é feita com `<input type="radio">` e o combinador de
 * irmãos — detalhes no arquivo de estilo. Era um componente de cliente com
 * `useState`; virou HTML e CSS, servido pronto.
 */

const MESES = ['Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'] as const;

/** O índice a partir do qual a linha deixa de ser fato e passa a ser projeção. */
const HOJE = 2;

const CENARIOS = [
  {
    id: 'conservador',
    rotulo: 'Conservador',
    valores: [43, 48, 46, 39, 33, 28],
    risco: 'moderado',
    resumo: 'As contas de junho e julho pressionam o caixa.',
    acao: 'Antecipe recebíveis e revise as despesas fixas antes de junho.',
  },
  {
    id: 'realista',
    rotulo: 'Realista',
    valores: [43, 48, 52, 57, 62, 68],
    risco: 'baixo',
    resumo: 'O caixa cresce mesmo com as contas já registradas.',
    acao: 'Mantenha a reserva e acompanhe os recebimentos maiores de julho.',
  },
  {
    id: 'otimista',
    rotulo: 'Otimista',
    valores: [43, 48, 57, 68, 82, 96],
    risco: 'baixo',
    resumo: 'A aprovação das propostas abertas acelera a formação de caixa.',
    acao: 'Planeje a agenda da equipe para dar conta sem perder margem.',
  },
] as const;

const PASSOS = [
  {
    icone: Sigma,
    titulo: 'O sistema faz a conta',
    texto:
      'Soma o que entrou, o que saiu e as contas a pagar e receber já registradas. Esta parte é aritmética do sistema — não é a IA que inventa o número.',
  },
  {
    icone: Lock,
    titulo: 'Só os totais saem daqui',
    texto:
      'O que é enviado são valores por mês. Nome de cliente, documento e descrição de serviço não saem do seu banco de dados.',
  },
  {
    icone: PenLine,
    titulo: 'A IA lê e escreve',
    texto:
      'Sobre esse cenário, ela aponta o nível de risco, o que merece atenção e o que fazer primeiro — em português, não em gráfico para você decifrar.',
  },
  {
    icone: UserCheck,
    titulo: 'Quem decide é você',
    texto:
      'Nada é executado sozinho: nenhuma conta é paga, nenhum preço é mudado. É apoio gerencial, e não substitui seu contador.',
  },
] as const;

/** Área de desenho do gráfico, em unidades do `viewBox`. */
const LARGURA = 640;
const ALTURA = 240;
const MARGEM = { topo: 24, direita: 74, baixo: 30, esquerda: 44 };
const TETO = 100;

function pontos(valores: readonly number[]) {
  const util = {
    x: LARGURA - MARGEM.esquerda - MARGEM.direita,
    y: ALTURA - MARGEM.topo - MARGEM.baixo,
  };

  return valores.map((valor, indice) => ({
    x: MARGEM.esquerda + (util.x * indice) / (valores.length - 1),
    y: MARGEM.topo + util.y * (1 - valor / TETO),
  }));
}

const traco = (lista: { x: number; y: number }[]) =>
  lista.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

export function DemonstracaoPrevisao() {
  return (
    <div className={styles.demo}>
      {CENARIOS.map((cenario, indice) => (
        <input
          key={cenario.id}
          type="radio"
          name="cenario-previsao"
          id={`cenario-${cenario.id}`}
          defaultChecked={indice === 1}
          className={styles.radio}
        />
      ))}

      <div className={styles.abas} role="group" aria-label="Cenário da previsão">
        {CENARIOS.map((cenario) => (
          <label key={cenario.id} htmlFor={`cenario-${cenario.id}`} className={styles.aba}>
            {cenario.rotulo}
          </label>
        ))}
      </div>

      <div className={styles.painel}>
        {CENARIOS.map((cenario) => (
          <Cenario key={cenario.id} cenario={cenario} />
        ))}
      </div>
    </div>
  );
}

function Cenario({ cenario }: { cenario: (typeof CENARIOS)[number] }) {
  const coordenadas = pontos(cenario.valores);
  const realizado = coordenadas.slice(0, HOJE + 1);
  const projetado = coordenadas.slice(HOJE);
  const fim = coordenadas.at(-1)!;
  const hoje = coordenadas[HOJE]!;
  const base = ALTURA - MARGEM.baixo;
  const IconeRisco = cenario.risco === 'baixo' ? CheckCircle2 : AlertTriangle;
  const saldoHoje = cenario.valores[HOJE]!;
  const saldoFim = cenario.valores.at(-1)!;
  const diferenca = saldoFim - saldoHoje;

  // A faixa de variação é o "mais ou menos" da projeção: 10% para cada lado.
  const acima = pontos(cenario.valores.map((v) => Math.min(TETO, v * 1.1))).slice(HOJE);
  const abaixo = pontos(cenario.valores.map((v) => v * 0.9))
    .slice(HOJE)
    .reverse();

  return (
    <div className={styles.cenario}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Saldo hoje" valor={`R$ ${saldoHoje} mil`} />
        <Numero
          rotulo="Projeção para agosto"
          valor={`R$ ${saldoFim} mil`}
          detalhe={`${diferenca >= 0 ? '+' : '−'} R$ ${Math.abs(diferenca)} mil em 3 meses`}
          destaque
        />
        <Numero rotulo="Contas consideradas" valor="47" detalhe="a pagar e a receber" />
      </div>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className={styles.grafico}
        role="img"
        aria-label={`Cenário ${cenario.rotulo}: saldo de R$ ${saldoHoje} mil hoje e R$ ${saldoFim} mil projetados para agosto.`}
      >
        <defs>
          <linearGradient id={`faixa-${cenario.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((valor) => {
          const y = MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.baixo) * (1 - valor / TETO);

          return (
            <g key={valor}>
              <line
                x1={MARGEM.esquerda}
                x2={LARGURA - MARGEM.direita}
                y1={y}
                y2={y}
                className="stroke-border"
              />
              <text x="0" y={y + 4} className="fill-muted-foreground text-[11px]">
                {valor === 0 ? 'R$ 0' : `${valor} mil`}
              </text>
            </g>
          );
        })}

        <path
          d={`${traco(acima)} ${abaixo.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`}
          fill={`url(#faixa-${cenario.id})`}
        />

        <line
          x1={hoje.x}
          x2={hoje.x}
          y1={MARGEM.topo - 8}
          y2={base}
          className="stroke-muted-foreground/45"
          strokeDasharray="4 5"
        />
        <text x={hoje.x + 6} y={MARGEM.topo - 10} className="fill-muted-foreground text-[11px]">
          hoje
        </text>

        <path
          d={traco(realizado)}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={traco(projetado)}
          fill="none"
          className={`stroke-foreground ${styles.linhaProjetada}`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coordenadas.map((ponto, indice) => (
          <circle
            key={MESES[indice]}
            cx={ponto.x}
            cy={ponto.y}
            r="4"
            className={indice <= HOJE ? 'fill-muted-foreground' : 'fill-foreground'}
            stroke="var(--card)"
            strokeWidth="2"
          />
        ))}

        <text
          x={fim.x + 10}
          y={fim.y + 4}
          className="fill-foreground text-[13px] font-semibold"
        >{`R$ ${saldoFim} mil`}</text>

        {MESES.map((mes, indice) => (
          <text
            key={mes}
            x={coordenadas[indice]!.x}
            y={ALTURA - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {mes}
          </text>
        ))}
      </svg>

      <div className="bg-superficie flex flex-col gap-2 rounded-lg border p-4">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <IconeRisco
            aria-hidden
            className={cenario.risco === 'baixo' ? 'text-sucesso size-4' : 'text-atencao size-4'}
          />
          O que a IA escreveu · risco {cenario.risco}
        </span>
        <p className="text-sm font-medium">{cenario.resumo}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{cenario.acao}</p>
      </div>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${destaque ? 'border-foreground/25 bg-superficie' : ''}`}
    >
      <p className="text-muted-foreground text-[0.625rem] font-medium tracking-wide uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="text-muted-foreground text-[0.6875rem]">{detalhe}</p>}
    </div>
  );
}

/**
 * Os quatro passos do caminho, do dado bruto à decisão.
 *
 * Fica fora do quadro do gráfico de propósito: é a explicação do mecanismo, e
 * vale para qualquer cenário escolhido ali em cima.
 */
export function ComoAIAFunciona() {
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {PASSOS.map((passo, indice) => (
        <li key={passo.titulo} className="flex flex-col gap-2">
          <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-md border border-current/10">
            <passo.icone aria-hidden className="size-4.5" />
          </span>
          <p className="text-sm font-semibold">
            <span className="text-muted-foreground mr-2 tabular-nums">0{indice + 1}</span>
            {passo.titulo}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">{passo.texto}</p>
        </li>
      ))}
    </ol>
  );
}
