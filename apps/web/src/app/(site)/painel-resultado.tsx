import { TrendingUp } from 'lucide-react';
import { PercentualMargem } from '@/components/ui/percentual-margem';
import { cn } from '@/lib/utils';
import { Revelar } from './revelar';

/**
 * O resultado do mês, numa tela só.
 *
 * Substitui um carrossel de três telas (orçamento → agenda → financeiro) que
 * contava a história do produto inteiro — e por isso não deixava claro o que
 * esta seção promete: **quanto sobrou**. Aqui não há troca de tela nem nada
 * para esperar; tudo está visível de uma vez.
 *
 * Cada bloco é a prova visual de um item da lista ao lado, na mesma ordem:
 * margem por serviço, retirada do dono contra o teto, e o caixa separando o
 * que já entrou do que ainda vai entrar. Quem lê o texto e olha o painel vê a
 * mesma coisa duas vezes — de propósito.
 *
 * ## A margem é calculada, não digitada
 *
 * Cada percentual sai de `receita` e `custo` do próprio serviço. Digitar "69%"
 * à mão num componente cujo argumento é justamente "a conta se faz sozinha"
 * seria a contradição mais fácil de alguém perceber. O rótulo usa o mesmo
 * `PercentualMargem` do painel de verdade, então a cor segue a regra real do
 * produto — e não uma cópia que pode divergir dela.
 *
 * ## Sem JavaScript
 *
 * Sem carrossel, não há estado, temporizador nem observador. É componente de
 * servidor: o navegador recebe HTML pronto. A entrada ao rolar é do `Revelar`,
 * que também é só CSS.
 *
 * Os números são ilustrativos. `aria-hidden` porque a lista ao lado diz em
 * texto exatamente o que este quadro mostra em forma — o mesmo motivo do
 * `PainelDeExemplo`.
 */

const SERVICOS = [
  { nome: 'Revisão completa', receita: 1240, custo: 380 },
  { nome: 'Instalação de ar-condicionado', receita: 980, custo: 410 },
  { nome: 'Troca de óleo', receita: 210, custo: 124 },
] as const;

const RESULTADO_DO_MES = 8420;
const RETIRADA = { tetoSugerido: 3200, jaRetirado: 2100 };
const CAIXA = { recebido: 6200, aReceber: 2220 };

function margem(receita: number, custo: number): number {
  return Math.round(((receita - custo) / receita) * 100);
}

function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR')}`;
}

export function PainelResultado() {
  const servicos = SERVICOS.map((servico) => ({
    ...servico,
    margem: margem(servico.receita, servico.custo),
  })).sort((a, b) => b.margem - a.margem);

  const percentualRetirado = Math.round((RETIRADA.jaRetirado / RETIRADA.tetoSugerido) * 100);
  const maiorValorCaixa = Math.max(CAIXA.recebido, CAIXA.aReceber);

  return (
    <Revelar>
      <div
        aria-hidden
        className="bg-card overflow-hidden rounded-xl border shadow-[var(--sombra-media)]"
      >
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Resultado do mês
            </p>
            <p className="numerico mt-1.5 text-4xl font-semibold tracking-tight">
              {reais(RESULTADO_DO_MES)}
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Depois de tirar o custo de cada serviço.
            </p>
          </div>
          <span className="bg-sucesso-suave text-sucesso flex size-10 shrink-0 items-center justify-center rounded-full">
            <TrendingUp className="size-5" />
          </span>
        </div>

        <Bloco titulo="Margem por serviço" detalhe="da maior para a menor">
          <div className="flex flex-col gap-3">
            {servicos.map((servico) => (
              <div key={servico.nome} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm">{servico.nome}</span>
                <Trilho>
                  <Preenchimento largura={servico.margem} className="bg-sucesso" />
                </Trilho>
                <span className="w-10 shrink-0 text-right text-sm">
                  <PercentualMargem percentual={servico.margem} />
                </span>
              </div>
            ))}
          </div>
        </Bloco>

        <Bloco
          titulo="Retirada do dono"
          detalhe={`${reais(RETIRADA.jaRetirado)} de ${reais(RETIRADA.tetoSugerido)}`}
        >
          <Trilho>
            <Preenchimento largura={percentualRetirado} className="bg-primary" />
          </Trilho>
          <p className="text-muted-foreground mt-2 text-xs">
            O teto é o que o caixa aguenta sem faltar para a operação.
          </p>
        </Bloco>

        <Bloco titulo="Caixa">
          <div className="flex flex-col gap-3">
            <LinhaDeCaixa
              rotulo="Já entrou"
              valor={CAIXA.recebido}
              maximo={maiorValorCaixa}
              className="bg-sucesso"
            />
            <LinhaDeCaixa
              rotulo="Ainda a receber"
              valor={CAIXA.aReceber}
              maximo={maiorValorCaixa}
              className="bg-muted-foreground/35"
            />
          </div>
        </Bloco>

        <p className="text-muted-foreground bg-superficie border-t px-5 py-3 text-center text-xs sm:px-6">
          Calculado sozinho pelo sistema · dados ilustrativos
        </p>
      </div>
    </Revelar>
  );
}

function Bloco({
  titulo,
  detalhe,
  children,
}: {
  titulo: string;
  detalhe?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{titulo}</p>
        {detalhe && <p className="text-muted-foreground numerico text-xs">{detalhe}</p>}
      </div>
      {children}
    </div>
  );
}

function Trilho({ children }: { children: React.ReactNode }) {
  return <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">{children}</div>;
}

function Preenchimento({ largura, className }: { largura: number; className: string }) {
  return <div className={cn('h-full rounded-full', className)} style={{ width: `${largura}%` }} />;
}

/**
 * Uma barra do caixa.
 *
 * A largura é relativa ao **maior** dos dois valores, e não a um total. Com
 * as duas barras na mesma escala, o olho compara "já entrou" com "a receber"
 * direto; se cada uma fosse de 0 a 100% de si mesma, as duas pareceriam
 * cheias e a comparação sumiria.
 */
function LinhaDeCaixa({
  rotulo,
  valor,
  maximo,
  className,
}: {
  rotulo: string;
  valor: number;
  maximo: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-28 shrink-0 text-sm">{rotulo}</span>
      <Trilho>
        <Preenchimento largura={(valor / maximo) * 100} className={className} />
      </Trilho>
      <span className="numerico w-20 shrink-0 text-right text-sm font-medium">{reais(valor)}</span>
    </div>
  );
}
