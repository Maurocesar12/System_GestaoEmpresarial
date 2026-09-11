'use client';

import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface OpcaoSegmentada<T extends string> {
  valor: T;
  rotulo: string;
  icone?: LucideIcon;
  /** Tom da opção quando escolhida. `neutro` é o padrão. */
  tom?: 'neutro' | 'positivo' | 'negativo';
}

const TOM_ATIVO = {
  neutro: 'bg-card text-foreground',
  positivo: 'bg-card text-sucesso',
  negativo: 'bg-card text-destructive',
} as const;

/**
 * Escolha entre duas ou três opções, todas visíveis.
 *
 * Existe para substituir o `<select>` onde as opções são poucas e a escolha
 * muda o resto do formulário — entrada ou saída, pago ou em aberto. O `select`
 * cobra três interações (abrir, procurar, escolher) e esconde as alternativas
 * até ser aberto; aqui a pessoa lê as duas e clica uma vez.
 *
 * Por dentro são `<input type="radio">` de verdade, e não botões: é o que
 * entrega navegação por setas, envio junto do formulário e o anúncio correto
 * ("Tipo, Entrada, 1 de 2") no leitor de tela — de graça, sem recriar nada.
 *
 * Para seleções longas (categoria, cliente), continue no `Selecao`: quinze
 * opções lado a lado viram uma parede, e o `select` nativo já traz busca por
 * digitação e a roda do celular.
 */
export function SeletorSegmentado<T extends string>({
  rotulo,
  ajuda,
  opcoes,
  valor,
  aoMudar,
  desabilitado = false,
  name,
}: {
  rotulo: string;
  ajuda?: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  desabilitado?: boolean;
  name: string;
}) {
  const idGrupo = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span id={idGrupo} className="text-sm font-medium">
        {rotulo}
      </span>

      <div
        role="radiogroup"
        aria-labelledby={idGrupo}
        className="bg-muted/60 grid auto-cols-fr grid-flow-col gap-1 rounded-md p-1"
      >
        {opcoes.map((opcao) => {
          const escolhida = opcao.valor === valor;
          const Icone = opcao.icone;

          return (
            <label
              key={opcao.valor}
              className={cn(
                'flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[0.3rem] px-3 text-sm font-medium transition-colors',
                'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-1',
                escolhida
                  ? cn(TOM_ATIVO[opcao.tom ?? 'neutro'], 'shadow-[var(--sombra-sutil)]')
                  : 'text-muted-foreground hover:text-foreground',
                desabilitado && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type="radio"
                name={name}
                value={opcao.valor}
                checked={escolhida}
                disabled={desabilitado}
                onChange={() => aoMudar(opcao.valor)}
                className="sr-only"
              />
              {Icone && <Icone aria-hidden className="size-4" />}
              {opcao.rotulo}
            </label>
          );
        })}
      </div>

      {ajuda && <p className="text-muted-foreground text-xs">{ajuda}</p>}
    </div>
  );
}
