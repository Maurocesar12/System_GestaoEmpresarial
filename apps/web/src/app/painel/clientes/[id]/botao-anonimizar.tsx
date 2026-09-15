'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { anonimizarCliente } from '../acoes';

/** Mesma confirmação em duas etapas do `BotaoRemover`: a ação não tem volta. */
export function BotaoAnonimizar({ id, nome }: { id: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [anonimizando, iniciar] = useTransition();

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
          Anonimizar cliente
        </Botao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        Eliminar os dados pessoais de <span className="font-semibold">{nome}</span>? Nome, contato,
        documento e anotações não poderão ser recuperados.
      </p>

      <div className="flex gap-2">
        <Botao
          type="button"
          variante="perigo"
          carregando={anonimizando}
          onClick={() =>
            iniciar(async () => {
              const resultado = await anonimizarCliente(id);
              setErro(resultado.erro);
              setConfirmando(false);
            })
          }
          className="w-fit"
        >
          Sim, anonimizar
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
