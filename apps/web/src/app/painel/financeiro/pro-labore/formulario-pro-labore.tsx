'use client';

import { CalendarPlus, Check, TrendingDown, TrendingUp, Wand2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { formatarBRL } from '@gestao/shared-types';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { SeletorSegmentado } from '@/components/ui/seletor-segmentado';
import type { ResultadoAcao } from '@/lib/acoes';
import { useSimulacao } from '@/lib/simulacao';
import { cn } from '@/lib/utils';
import { definirProLabore, simularProLabore } from './acoes';

/** Quando o novo valor passa a valer. "Outra" abre o campo de data. */
type Inicio = 'proximoMes' | 'esteMes' | 'outra';

function primeiroDiaDoMes(deslocamento: number): string {
  const agora = new Date();
  const alvo = new Date(agora.getFullYear(), agora.getMonth() + deslocamento, 1);
  const mes = String(alvo.getMonth() + 1).padStart(2, '0');

  return `${alvo.getFullYear()}-${mes}-01`;
}

function rotularMes(dia: string): string {
  const [ano, mes] = dia.split('-').map(Number);

  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(ano!, mes! - 1, 1),
  );
}

/**
 * Define um novo valor de pró-labore.
 *
 * Três atalhos para o que a pessoa quase sempre quer:
 *
 * 1. **"Usar o teto"** preenche o valor sugerido com um clique. Antes, o teto
 *    aparecia como texto de ajuda e precisava ser redigitado à mão — inclusive
 *    o centavo, que ninguém acerta de primeira.
 * 2. **Quando passa a valer** é escolha entre dois meses nomeados, não um
 *    calendário: reajuste de retirada quase sempre começa no dia 1, e o mês
 *    aparece escrito ("outubro de 2026") para não restar dúvida.
 * 3. **A prévia** diz, antes de salvar, se o valor digitado cabe no teto e
 *    quanto sobra. Sem ela, a pessoa salvava, rolava a página para cima e só
 *    então descobria que tinha passado do limite.
 *
 * Continua sem React Hook Form: são dois campos, e o erro que importa vem da
 * API (data repetida), não da validação local.
 */
export function FormularioProLabore({
  tetoSugerido,
  valorVigente,
  meses,
}: {
  /** Teto em decimal (`"5000.00"`), como a API devolve. */
  tetoSugerido: string;
  /** Retirada atual, ou `null` se nunca foi definida. */
  valorVigente: string | null;
  /** A janela da média escolhida na página — a prévia usa a mesma. */
  meses: string;
}) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();
  const [valor, setValor] = useState('');
  const [inicio, setInicio] = useState<Inicio>('proximoMes');
  const [dataEscolhida, setDataEscolhida] = useState(primeiroDiaDoMes(1));

  // "Cabe no teto?" é a API que responde, com o valor como foi digitado.
  const previa = useSimulacao(valor ? { valor, meses } : null, simularProLabore);

  const vigenciaInicio =
    inicio === 'outra' ? dataEscolhida : primeiroDiaDoMes(inicio === 'esteMes' ? 0 : 1);

  return (
    <form
      className="flex flex-col gap-4"
      action={() => {
        setFalha(undefined);

        iniciarEnvio(async () => {
          const resultado = await definirProLabore({ valor, vigenciaInicio });

          if (resultado.erro) {
            setFalha(resultado);
            return;
          }

          setValor('');
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Campo
            name="valor"
            rotulo="Novo valor mensal"
            inputMode="decimal"
            placeholder="0,00"
            required
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            erro={falha?.campos?.valor?.[0]}
            ajuda={
              valorVigente
                ? `Retirada atual: ${formatarBRL(valorVigente)}`
                : 'Ainda não há retirada definida.'
            }
          />

          <Botao
            type="button"
            variante="secundario"
            tamanho="sm"
            className="w-fit"
            onClick={() => setValor(tetoSugerido.replace('.', ','))}
          >
            <Wand2 aria-hidden />
            Usar o teto ({formatarBRL(tetoSugerido)})
          </Botao>
        </div>

        <div className="flex flex-col gap-2">
          <SeletorSegmentado
            rotulo="Vale a partir de"
            name="inicio"
            valor={inicio}
            aoMudar={setInicio}
            opcoes={[
              { valor: 'proximoMes', rotulo: rotularMes(primeiroDiaDoMes(1)), icone: CalendarPlus },
              { valor: 'esteMes', rotulo: rotularMes(primeiroDiaDoMes(0)) },
              { valor: 'outra', rotulo: 'Outra data' },
            ]}
          />

          {inicio === 'outra' ? (
            <Campo
              name="vigenciaInicio"
              rotulo="Data de início"
              type="date"
              required
              value={dataEscolhida}
              onChange={(evento) => setDataEscolhida(evento.target.value)}
              erro={falha?.campos?.vigenciaInicio?.[0]}
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              Começa no dia 1. Mudar no meio do mês partiria o mês em duas vigências e complicaria a
              conferência com o contador.
            </p>
          )}
        </div>
      </div>

      {previa && <Previa sobra={previa.sobra} cabeNoTeto={previa.cabeNoTeto} />}

      {falha?.erro && <AvisoErro mensagem={falha.erro} detalhes={falha.campos} />}

      <Botao type="submit" carregando={enviando} className="w-fit">
        Definir pró-labore
      </Botao>
    </form>
  );
}

/**
 * O efeito do valor digitado, antes de salvar.
 *
 * Mostra a folga que resultaria — o mesmo número do indicador no topo da
 * página, só que enquanto ainda dá para mudar de ideia.
 */
function Previa({ sobra, cabeNoTeto }: { sobra: string; cabeNoTeto: boolean }) {
  const acimaDoTeto = !cabeNoTeto;
  const Icone = acimaDoTeto ? TrendingDown : Number(sobra) === 0 ? Check : TrendingUp;

  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
        acimaDoTeto ? 'bg-atencao-suave text-atencao' : 'bg-sucesso-suave text-sucesso',
      )}
    >
      <Icone aria-hidden className="size-4 shrink-0" />
      {acimaDoTeto ? (
        <span>
          <strong className="font-semibold">
            {formatarBRL(sobra.replace('-', ''))} acima do teto.
          </strong>{' '}
          Dá para retirar, mas consome o que o negócio precisaria guardar.
        </span>
      ) : (
        <span>
          Cabe no teto, com folga de <strong className="font-semibold">{formatarBRL(sobra)}</strong>{' '}
          por mês.
        </span>
      )}
    </p>
  );
}
