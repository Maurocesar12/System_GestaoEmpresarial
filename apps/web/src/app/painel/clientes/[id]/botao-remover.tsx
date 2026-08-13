'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { removerCliente } from '../acoes';

/**
 * Exclusão de cliente, com confirmação em duas etapas.
 *
 * O primeiro clique revela a confirmação; o segundo executa. É uma ação que
 * apaga histórico em cascata e não tem desfazer — um clique acidental não pode
 * ser suficiente.
 *
 * A confirmação é feita na própria página, e não com `window.confirm`: o
 * diálogo nativo não é estilizável, aparece deslocado do contexto e alguns
 * navegadores permitem que o usuário o suprima para sempre.
 */
export function BotaoRemover({ id, nome }: { id: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [removendo, iniciarRemocao] = useTransition();

  if (!confirmando) {
    return (
      <div className="flex flex-col gap-2">
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}

        <Botao
          type="button"
          variante="secundario"
          onClick={() => setConfirmando(true)}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 w-fit"
        >
          Excluir cliente
        </Botao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        Excluir <span className="font-semibold">{nome}</span> e todo o histórico?
      </p>

      <div className="flex gap-2">
        <Botao
          type="button"
          carregando={removendo}
          onClick={() =>
            iniciarRemocao(async () => {
              const resultado = await removerCliente(id);
              // Em caso de sucesso a action redireciona e nada aqui executa.
              setErro(resultado?.erro);
              setConfirmando(false);
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
