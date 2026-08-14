'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { removerLancamento } from '../acoes';

/**
 * Exclusão de lançamento, com confirmação em duas etapas.
 *
 * O valor sai do fluxo de caixa e da margem do período — um clique acidental
 * mudaria números que o dono usa para decidir preço, sem deixar rastro.
 */
export function BotaoRemoverLancamento({ id }: { id: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [removendo, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <div className="flex flex-col gap-2">
        {erro && <AvisoErro mensagem={erro} />}

        <Botao
          type="button"
          variante="secundario"
          onClick={() => setConfirmando(true)}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 w-fit"
        >
          Excluir lançamento
        </Botao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Excluir este lançamento?</p>

      <div className="flex gap-2">
        <Botao
          type="button"
          carregando={removendo}
          onClick={() =>
            iniciar(async () => {
              setErro(undefined);
              const resultado = await removerLancamento(id);

              if (resultado.erro) {
                setErro(resultado.erro);
                setConfirmando(false);
                return;
              }

              // A action revalida mas não redireciona: sem isto, a pessoa
              // ficaria numa página de um lançamento que não existe mais.
              router.push('/painel/financeiro');
            })
          }
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-fit"
        >
          Sim, excluir
        </Botao>

        <Botao
          type="button"
          variante="secundario"
          onClick={() => setConfirmando(false)}
          className="w-fit"
        >
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
