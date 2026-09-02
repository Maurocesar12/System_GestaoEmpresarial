'use client';

import { useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { removerProLabore } from './acoes';

/**
 * Remove uma vigência do histórico.
 *
 * Confirmação em duas etapas no próprio botão, sem caixa de diálogo: a ação é
 * rara e reversível por recadastro, e um `confirm()` do navegador não segue o
 * tema nem o teclado do resto do sistema.
 */
export function BotaoRemoverVigencia({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [removendo, iniciarRemocao] = useTransition();

  if (!confirmando) {
    return (
      <Botao
        variante="sutil"
        tamanho="sm"
        onClick={() => setConfirmando(true)}
        aria-label="Remover esta vigência"
      >
        Remover
      </Botao>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1.5">
      {erro && <span className="text-destructive text-xs">{erro}</span>}

      <Botao
        variante="perigo"
        tamanho="sm"
        carregando={removendo}
        onClick={() =>
          iniciarRemocao(async () => {
            const resultado = await removerProLabore(id);

            if (resultado.erro) {
              setErro(resultado.erro);
              setConfirmando(false);
            }
          })
        }
      >
        Confirmar
      </Botao>

      <Botao variante="sutil" tamanho="sm" onClick={() => setConfirmando(false)}>
        Cancelar
      </Botao>
    </span>
  );
}
