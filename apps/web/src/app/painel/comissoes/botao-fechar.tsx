'use client';

import { formatarBRL } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
import { cn } from '@/lib/utils';
import { fecharComissoes } from './acoes';

/**
 * Fecha as pendentes de uma pessoa no período filtrado.
 *
 * Pede o vencimento no próprio botão, em duas etapas: fechar cria uma conta a
 * pagar, e um clique acidental geraria uma despesa no financeiro.
 */
export function BotaoFecharComissoes({
  usuarioId,
  nome,
  valor,
  de,
  ate,
}: {
  usuarioId: string;
  nome: string;
  valor: string;
  de: string;
  ate: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [vencimento, setVencimento] = useState('');
  const [erro, setErro] = useState<string>();
  const [fechando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  if (!aberto) {
    return (
      <Botao type="button" tamanho="sm" variante="secundario" onClick={() => setAberto(true)}>
        Fechar
      </Botao>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs">
        Gerar conta a pagar de {formatarBRL(valor)} para {nome}?
      </p>
      <label className="flex items-center gap-2 text-xs">
        Vencimento
        <input
          type="date"
          value={vencimento}
          onChange={(evento) => setVencimento(evento.target.value)}
          className={cn(estilosControle, 'h-8 w-36')}
        />
      </label>
      <div className="flex gap-2">
        <Botao
          type="button"
          tamanho="sm"
          carregando={fechando}
          onClick={() =>
            iniciar(async () => {
              setErro(undefined);
              const resultado = await fecharComissoes({ usuarioId, de, ate, vencimento });
              setErro(resultado.erro);
              if (resultado.fechamento) {
                setAberto(false);
                avisar(
                  'sucesso',
                  `Conta a pagar de ${formatarBRL(resultado.fechamento.valor)} criada no financeiro.`,
                );
              }
            })
          }
        >
          Confirmar
        </Botao>
        <Botao type="button" tamanho="sm" variante="sutil" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}
    </div>
  );
}
