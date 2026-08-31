import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EstadoVazioProps {
  icone?: LucideIcon;
  titulo: string;
  /** Uma frase explicando o que fazer a seguir — não "nenhum resultado". */
  descricao?: string;
  /** Ação que resolve o vazio: normalmente o botão de cadastrar. */
  acao?: ReactNode;
  className?: string;
}

/**
 * Tela sem conteúdo.
 *
 * Vazio é o primeiro contato de quem acabou de criar a conta, e é aí que o
 * sistema parece quebrado ou parece pensado. Por isso o componente exige um
 * título e aceita uma ação: a intenção é sempre dizer o próximo passo, em vez
 * de informar que não há nada.
 *
 * A borda tracejada é proposital — comunica "aqui vai entrar conteúdo", ao
 * contrário da borda cheia, que passa a ideia de um bloco que já terminou.
 */
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: EstadoVazioProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {Icone && (
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <Icone aria-hidden className="size-5" />
        </span>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{titulo}</p>
        {descricao && <p className="text-muted-foreground max-w-sm text-sm">{descricao}</p>}
      </div>

      {acao}
    </div>
  );
}
