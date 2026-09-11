'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { DIAS_AVISO_PAGAMENTO, type SituacaoDeAcesso } from '@gestao/shared-types';
import { cn } from '@/lib/utils';

const CHAVE = 'gestao:aviso-pagamento';

/** Evento próprio: `storage` só avisa as **outras** abas, nunca a que gravou. */
const EVENTO = 'gestao:aviso-pagamento-mudou';

function inscrever(aoMudar: () => void): () => void {
  window.addEventListener('storage', aoMudar);
  window.addEventListener(EVENTO, aoMudar);

  return () => {
    window.removeEventListener('storage', aoMudar);
    window.removeEventListener(EVENTO, aoMudar);
  };
}

function lerDispensa(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    // Navegador com armazenamento bloqueado: trata como não dispensado, que é
    // o padrão seguro — esconder o aviso arrisca a pessoa perder o acesso.
    return null;
  }
}

/**
 * Aviso de vencimento do acesso, no topo do painel.
 *
 * ## Uma linha, e nada mais
 *
 * A versão anterior era uma faixa amarela cheia, com frase longa e botão
 * grande — do tamanho de um erro, para uma informação que não é erro nenhum.
 * Aqui é uma linha fina: a data, quantos dias faltam e um link discreto.
 * O que interessa lido de relance, sem tomar a tela de quem entrou para
 * trabalhar.
 *
 * ## Fechar, e voltar amanhã
 *
 * Dá para dispensar. A dispensa vale **para o dia**, e não para sempre: a
 * chave guardada carrega a data de hoje, então amanhã o aviso volta. Um botão
 * de fechar definitivo transformaria o lembrete em algo que some justamente
 * de quem mais precisa dele — e o acesso cairia sem avisar.
 *
 * O estado vive no `localStorage`, e não no servidor: é preferência de tela de
 * uma pessoa num navegador, não dado da empresa.
 *
 * ## Quando aparece
 *
 * - **Período de teste**: sempre. O prazo é curto e a data importa todo dia.
 * - **Pago**: só na última semana antes do vencimento. Aviso permanente vira
 *   paisagem e deixa de ser lido justamente quando passa a ser urgente.
 *
 * Vencido não chega aqui: a API recusa o login antes.
 */
export function AvisoPagamento({ acesso }: { acesso?: SituacaoDeAcesso }) {
  /*
   * `useSyncExternalStore` em vez de `useEffect` + `useState`: é o jeito que o
   * React oferece para ler algo que vive fora dele — aqui, o `localStorage`.
   * No servidor devolve `null` (nada dispensado); na hidratação o React lê o
   * valor real e reconcilia sozinho, sem aviso de mismatch e sem a cascata de
   * renderizações que o `setState` dentro do efeito provocava.
   */
  const dispensa = useSyncExternalStore(inscrever, lerDispensa, () => null);

  if (!acesso?.acessoAte || acesso.diasRestantes === null) return null;
  if (dispensa === marca(acesso.acessoAte)) return null;

  const emTeste = acesso.motivo === 'trial';
  const perto = acesso.diasRestantes <= DIAS_AVISO_PAGAMENTO;

  if (!emTeste && !perto) return null;

  const urgente = acesso.diasRestantes <= 3;

  const dispensar = () => {
    try {
      window.localStorage.setItem(CHAVE, marca(acesso.acessoAte!));
    } catch {
      // Sem armazenamento o aviso não fecha. Raro, e melhor do que sumir sem
      // conseguir voltar amanhã.
    }

    // Avisa este componente (e qualquer outra aba) de que a chave mudou.
    window.dispatchEvent(new Event(EVENTO));
  };

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 border-b px-4 py-1.5 text-xs sm:px-6',
        urgente ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', urgente ? 'bg-destructive' : 'bg-atencao')}
      />

      <p className="min-w-0 truncate">
        {emTeste ? 'Teste até' : 'Acesso até'}{' '}
        <strong className="text-foreground font-semibold">{formatar(acesso.acessoAte)}</strong>
        <span className="text-muted-foreground"> · {rotularPrazo(acesso.diasRestantes)}</span>
      </p>

      <Link
        href="/painel/plano"
        className="ml-auto shrink-0 font-medium underline-offset-4 hover:underline"
      >
        Pagar
      </Link>

      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar o aviso até amanhã"
        className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded p-1 transition-colors"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

/** Dispensa amarrada ao dia **e** ao prazo: qualquer um dos dois mudar traz o aviso de volta. */
function marca(acessoAte: string): string {
  return `${acessoAte}|${new Date().toISOString().slice(0, 10)}`;
}

function formatar(dia: string): string {
  return new Date(`${dia}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** "vence hoje" lê melhor que "faltam 0 dias" — e é o dia que mais importa. */
function rotularPrazo(dias: number): string {
  if (dias <= 0) return 'vence hoje';
  if (dias === 1) return 'falta 1 dia';

  return `faltam ${dias} dias`;
}
