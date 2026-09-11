import { CalendarClock, CreditCard } from 'lucide-react';
import Link from 'next/link';
import {
  DIAS_AVISO_PAGAMENTO,
  mensagemDeAcesso,
  type SituacaoDeAcesso,
} from '@gestao/shared-types';
import { cn } from '@/lib/utils';

/**
 * Aviso de vencimento do acesso, no topo do painel.
 *
 * Aparece assim que a pessoa entra, porque é o único momento garantido: quem
 * descobre que precisa pagar no dia em que o sistema fecha já perdeu o acesso
 * — e perdeu junto a confiança de que foi avisado.
 *
 * ## Quando aparece
 *
 * - **Período de teste**: sempre. O prazo é curto e a data importa todo dia.
 * - **Pago**: só na última semana antes do vencimento. Um aviso permanente de
 *   algo que vence daqui a três semanas vira parte do cenário e deixa de ser
 *   lido justamente quando passa a ser urgente.
 *
 * Vencido não chega aqui: a API já recusou o login.
 */
export function AvisoPagamento({ acesso }: { acesso?: SituacaoDeAcesso }) {
  if (!acesso?.acessoAte || acesso.diasRestantes === null) return null;

  const emTeste = acesso.motivo === 'trial';
  const perto = acesso.diasRestantes <= DIAS_AVISO_PAGAMENTO;

  if (!emTeste && !perto) return null;

  const urgente = acesso.diasRestantes <= 3;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6',
        urgente ? 'bg-destrutivo-suave text-destructive' : 'bg-atencao-suave text-atencao',
      )}
    >
      <p className="flex items-center gap-2">
        <CalendarClock aria-hidden className="size-4 shrink-0" />
        <span>
          {mensagemDeAcesso(acesso)}{' '}
          <strong className="font-semibold">{rotularPrazo(acesso.diasRestantes)}</strong>
        </span>
      </p>

      <Link
        href="/painel/plano"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-current/25 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-current/10"
      >
        <CreditCard aria-hidden className="size-3.5" />
        Ver plano e pagamento
      </Link>
    </div>
  );
}

/** "vence hoje" lê melhor que "faltam 0 dias" — e é o dia que mais importa. */
function rotularPrazo(dias: number): string {
  if (dias <= 0) return 'Vence hoje.';
  if (dias === 1) return 'Falta 1 dia.';

  return `Faltam ${dias} dias.`;
}
