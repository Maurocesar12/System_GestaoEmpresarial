import { ChevronDown, Cog, Eye, MousePointerClick, type LucideIcon } from 'lucide-react';
import { NOME_DO_OPERADOR } from '@/lib/operadores';
import { CONTA_DO_EXEMPLO, JORNADA, reais, resumirContaDoExemplo } from './conteudo';

/**
 * Um serviço, do telefonema à conta fechada — para abrir etapa por etapa.
 *
 * ## Por que uma história, e não uma lista de passos
 *
 * "Você cadastra, o sistema organiza, o resultado aparece" descreve qualquer
 * software do mundo, e por isso não explica nada. Seguir **uma cliente** — a
 * Maria, uma instalação de R$ 980 — deixa visível o que só este produto faz: o
 * dinheiro nasce ligado ao serviço, e a sobra aparece sem ninguém montar
 * relatório.
 *
 * Cada etapa responde às três perguntas de quem avalia: o que eu faço, o que o
 * sistema faz por mim e o que eu passo a ver. A do meio é a que convence — e a
 * que mais precisa ser verdadeira (veja `conteudo.ts`).
 *
 * ## Curiosidade, sem JavaScript
 *
 * Só a primeira etapa nasce aberta; as outras mostram uma linha que dá vontade
 * de abrir. `<details name="jornada">` faz as etapas se comportarem como
 * sanfona — abrir uma fecha a anterior — sem estado nem hidratação, na mesma
 * linha do restante da página, que é HTML servido pronto. Onde o navegador não
 * entende o `name`, as etapas simplesmente podem ficar abertas juntas: o texto
 * continua todo lá.
 */
export function JornadaDoServico() {
  return (
    <ol className="flex flex-col gap-3">
      {JORNADA.map((etapa, indice) => (
        <li key={etapa.titulo}>
          <details
            name="jornada"
            open={indice === 0}
            className="group bg-card rounded-lg border shadow-(--sombra-sutil) open:shadow-(--sombra-media)"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 p-4 select-none sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                {indice + 1}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold tracking-tight">{etapa.titulo}</span>
                <span className="text-muted-foreground text-sm">{etapa.chamada}</span>
              </span>

              <ChevronDown
                aria-hidden
                className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="grid gap-6 border-t p-4 sm:p-5 md:grid-cols-3">
              <Quadro icone={MousePointerClick} titulo="Você faz">
                {etapa.voceFaz}
              </Quadro>

              {/* É a coluna que convence: destaca-se das outras duas. */}
              <Quadro icone={Cog} titulo="O sistema faz sozinho" destaque>
                {etapa.sistemaFaz}
              </Quadro>

              <Quadro icone={Eye} titulo="Você passa a ver">
                {etapa.voceVe}
              </Quadro>
            </div>

            {etapa.mostraConta && <ContaFinal />}
          </details>
        </li>
      ))}
    </ol>
  );
}

function Quadro({
  icone: Icone,
  titulo,
  destaque = false,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        destaque
          ? 'bg-superficie flex flex-col gap-2 rounded-md border p-4'
          : 'flex flex-col gap-2 p-1 md:p-4 md:pl-0'
      }
    >
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        <Icone aria-hidden className="text-muted-foreground size-4" />
        {titulo}
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * A conta, linha a linha.
 *
 * Os três custos são as três fontes que o relatório de margem soma de verdade
 * (material do estoque, comissão e despesas ligadas ao serviço). O total e o
 * percentual saem da soma — não são digitados.
 *
 * Cada sinal tem uma frase para o leitor de tela ("menos"): o símbolo, sozinho,
 * é lido de forma inconsistente, e a conta viraria uma lista de nomes.
 */
function ContaFinal() {
  const { sobra, percentual } = resumirContaDoExemplo();

  return (
    <div className="border-t p-4 sm:p-5">
      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
        A conta da {CONTA_DO_EXEMPLO.servico.toLowerCase()}
      </p>

      <dl className="flex max-w-md flex-col gap-2 text-sm">
        <Linha rotulo="Recebido da Maria" valor={reais(CONTA_DO_EXEMPLO.receita)} />

        {CONTA_DO_EXEMPLO.custos.map((custo) => (
          <Linha key={custo.rotulo} rotulo={custo.rotulo} valor={reais(custo.valor)} operador="−" />
        ))}

        <Linha rotulo="Sobrou" valor={`${reais(sobra)} · ${percentual}%`} operador="=" resultado />
      </dl>

      <p className="text-muted-foreground mt-3 text-xs">
        Nomes e valores de exemplo. No sistema, estes números são os da sua empresa.
      </p>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  operador,
  resultado = false,
}: {
  rotulo: string;
  valor: string;
  operador?: '−' | '=';
  resultado?: boolean;
}) {
  return (
    <div
      className={
        resultado
          ? 'flex items-baseline justify-between gap-4 border-t pt-2 font-semibold'
          : 'flex items-baseline justify-between gap-4'
      }
    >
      <dt className={resultado ? undefined : 'text-muted-foreground'}>
        {operador && (
          <>
            <span aria-hidden className="mr-2 inline-block w-3 text-center">
              {operador}
            </span>
            <span className="sr-only">{NOME_DO_OPERADOR[operador]} </span>
          </>
        )}
        {rotulo}
      </dt>
      <dd className="numerico shrink-0 font-medium">{valor}</dd>
    </div>
  );
}
