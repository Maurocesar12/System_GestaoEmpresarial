'use client';

import type { StatusLancamento } from '@gestao/shared-types';
import { Check, Undo2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { darBaixa, estornarBaixa } from './acoes';

/**
 * Dar baixa e estornar, direto na linha da tabela.
 *
 * A baixa mora aqui, e não numa tela separada, porque o gesto real é conferir o
 * extrato e ir marcando várias contas seguidas. Obrigar a abrir cada lançamento
 * transformaria cinco cliques em vinte.
 *
 * Sem data no botão: a API usa o dia de hoje, que é o caso comum. Quem precisa
 * registrar uma data diferente edita o lançamento.
 */
export function AcoesBaixa({ id, status }: { id: string; status: StatusLancamento }) {
  const [erro, setErro] = useState<string>();
  const [processando, iniciar] = useTransition();

  const executar = (acao: () => Promise<{ erro?: string }>) =>
    iniciar(async () => {
      setErro(undefined);
      const resultado = await acao();
      setErro(resultado.erro);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'pago' ? (
        <Botao
          variante="sutil"
          tamanho="sm"
          disabled={processando}
          onClick={() => executar(() => estornarBaixa(id))}
        >
          <Undo2 aria-hidden />
          Estornar
        </Botao>
      ) : (
        <Botao
          variante="secundario"
          tamanho="sm"
          disabled={processando}
          onClick={() => executar(() => darBaixa(id))}
        >
          <Check aria-hidden />
          Dar baixa
        </Botao>
      )}

      {erro && (
        <p role="alert" className="text-destructive max-w-52 text-right text-xs">
          {erro}
        </p>
      )}
    </div>
  );
}
