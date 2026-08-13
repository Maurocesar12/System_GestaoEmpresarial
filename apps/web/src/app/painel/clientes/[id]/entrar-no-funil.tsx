'use client';

import type { EtapaFunil } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { moverCliente } from '../../funil/acoes';

/**
 * Coloca o cliente no funil a partir da ficha dele.
 *
 * Existe porque cadastrar um cliente e iniciar uma negociação são coisas
 * diferentes: muita gente cadastra depois do serviço feito, sem nunca ter
 * havido funil. Entrar no quadro é uma decisão explícita, tomada aqui.
 */
export function EntrarNoFunil({
  clienteId,
  etapas,
  etapaAtual,
}: {
  clienteId: string;
  etapas: EtapaFunil[];
  etapaAtual: string | null;
}) {
  const [erro, setErro] = useState<string>();
  const [salvando, iniciarSalvamento] = useTransition();
  const [selecionada, setSelecionada] = useState(etapaAtual ?? etapas[0]?.id ?? '');

  if (etapas.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Funil de vendas</h2>
        <p className="text-muted-foreground text-sm">
          {etapaAtual
            ? 'Este cliente está no funil. Você pode mudar a etapa por aqui.'
            : 'Este cliente ainda não está no funil.'}
        </p>
      </div>

      {erro && <AvisoErro mensagem={erro} />}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="etapa-funil" className="sr-only">
          Etapa do funil
        </label>
        <select
          id="etapa-funil"
          value={selecionada}
          onChange={(evento) => setSelecionada(evento.target.value)}
          className="focus-visible:ring-ring h-10 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nome}
            </option>
          ))}
        </select>

        <Botao
          type="button"
          variante="secundario"
          carregando={salvando}
          onClick={() =>
            iniciarSalvamento(async () => {
              setErro(undefined);
              const resultado = await moverCliente({ clienteId, etapaId: selecionada });
              setErro(resultado.erro);
            })
          }
        >
          {etapaAtual ? 'Mudar etapa' : 'Colocar no funil'}
        </Botao>
      </div>
    </section>
  );
}
