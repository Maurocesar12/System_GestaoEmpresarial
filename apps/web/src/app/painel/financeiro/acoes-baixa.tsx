'use client';

import type { StatusLancamento } from '@gestao/shared-types';
import { Check, Undo2 } from 'lucide-react';
import { useTransition } from 'react';
import { useAvisos } from '@/components/ui/avisos';
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
 *
 * O retorno vai para o aviso flutuante, e não para um parágrafo dentro da
 * célula. Numa tabela, uma mensagem de erro na linha empurra as de baixo e
 * desloca justamente os botões que a pessoa está clicando em sequência.
 */
export function AcoesBaixa({ id, status }: { id: string; status: StatusLancamento }) {
  const [processando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  const executar = (acao: () => Promise<{ erro?: string }>, sucesso: string) =>
    iniciar(async () => {
      const resultado = await acao();

      if (resultado.erro) {
        avisar('erro', resultado.erro);
        return;
      }

      avisar('sucesso', sucesso);
    });

  if (status === 'pago') {
    return (
      <Botao
        variante="sutil"
        tamanho="sm"
        carregando={processando}
        onClick={() => executar(() => estornarBaixa(id), 'Baixa estornada.')}
      >
        <Undo2 aria-hidden />
        Estornar
      </Botao>
    );
  }

  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      carregando={processando}
      onClick={() => executar(() => darBaixa(id), 'Baixa registrada.')}
    >
      <Check aria-hidden />
      Dar baixa
    </Botao>
  );
}
