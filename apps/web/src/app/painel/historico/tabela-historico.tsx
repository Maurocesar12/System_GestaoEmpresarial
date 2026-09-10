'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { removerHistorico } from './acoes';

export interface LinhaHistorico {
  id: string;
  data: string;
  responsavel: string;
  acao: string;
  registro: string;
  resumo: string;
}

export function TabelaHistorico({ registros }: { registros: LinhaHistorico[] }) {
  const [erro, setErro] = useState<string>();

  return (
    <div className="flex flex-col gap-3">
      {erro && <AvisoErro mensagem={erro} />}

      <Cartao>
        <TabelaRolavel>
          <TabelaCabecalho>
            <TabelaColuna>Data</TabelaColuna>
            <TabelaColuna>Responsável</TabelaColuna>
            <TabelaColuna>Ação</TabelaColuna>
            <TabelaColuna>Registro</TabelaColuna>
            <TabelaColuna>Resumo</TabelaColuna>
            <TabelaColuna className="w-0 text-right">Ações</TabelaColuna>
          </TabelaCabecalho>
          <TabelaCorpo>
            {registros.map((registro) => (
              <TabelaLinha key={registro.id}>
                <TabelaCelula suave className="whitespace-nowrap">
                  {registro.data}
                </TabelaCelula>
                <TabelaCelula>{registro.responsavel}</TabelaCelula>
                <TabelaCelula>{registro.acao}</TabelaCelula>
                <TabelaCelula>{registro.registro}</TabelaCelula>
                <TabelaCelula className="min-w-[20rem]">
                  <span className="line-clamp-2">{registro.resumo}</span>
                </TabelaCelula>
                <TabelaCelula className="text-right">
                  <BotaoExcluirHistorico
                    id={registro.id}
                    resumo={registro.resumo}
                    onErro={setErro}
                  />
                </TabelaCelula>
              </TabelaLinha>
            ))}
          </TabelaCorpo>
        </TabelaRolavel>
      </Cartao>
    </div>
  );
}

function BotaoExcluirHistorico({
  id,
  resumo,
  onErro,
}: {
  id: string;
  resumo: string;
  onErro: (erro?: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <Botao
        type="button"
        variante="sutil"
        tamanho="sm"
        onClick={() => setConfirmando(true)}
        aria-label={`Excluir histórico: ${resumo}`}
      >
        <Trash2 aria-hidden />
        Excluir
      </Botao>
    );
  }

  return (
    <span className="inline-flex min-w-40 items-center justify-end gap-2 whitespace-nowrap text-xs">
      <span className="text-muted-foreground">Excluir?</span>
      <button
        type="button"
        disabled={excluindo}
        onClick={() =>
          iniciar(async () => {
            onErro(undefined);
            const resultado = await removerHistorico(id);

            if (resultado.erro) {
              onErro(resultado.erro);
              return;
            }

            setConfirmando(false);
          })
        }
        className="text-destructive font-medium underline-offset-4 hover:underline disabled:opacity-50"
      >
        sim
      </button>
      <button
        type="button"
        disabled={excluindo}
        onClick={() => setConfirmando(false)}
        className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        não
      </button>
    </span>
  );
}
