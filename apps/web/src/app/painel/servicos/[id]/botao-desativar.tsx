'use client';

import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { desativarServico } from '../acoes';

/**
 * Desativa um serviço.
 *
 * Sem confirmação em duas etapas, ao contrário da exclusão de cliente: desativar
 * é reversível — basta editar e marcar como ativo de novo. Pedir confirmação
 * para uma ação que se desfaz sozinha só treina a pessoa a clicar "sim" sem ler.
 */
export function BotaoDesativar({ id }: { id: string }) {
  const [erro, setErro] = useState<string>();
  const [executando, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {erro && <AvisoErro mensagem={erro} />}

      <Botao
        type="button"
        variante="secundario"
        carregando={executando}
        onClick={() =>
          iniciar(async () => {
            setErro(undefined);
            const resultado = await desativarServico(id);
            setErro(resultado.erro);
          })
        }
        className="w-fit"
      >
        Desativar serviço
      </Botao>
    </div>
  );
}
