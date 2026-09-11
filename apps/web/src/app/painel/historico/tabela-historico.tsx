'use client';

import { Trash2, X } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
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
import { removerHistorico, removerHistoricos } from './acoes';

export interface LinhaHistorico {
  id: string;
  data: string;
  responsavel: string;
  acao: string;
  registro: string;
  resumo: string;
}

export function TabelaHistorico({ registros }: { registros: LinhaHistorico[] }) {
  const [linhas, setLinhas] = useState(registros);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [erro, setErro] = useState<string>();
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [excluindoLote, iniciarExclusaoLote] = useTransition();
  const idsVisiveis = useMemo(() => linhas.map((registro) => registro.id), [linhas]);
  const quantidadeSelecionada = selecionados.size;
  const todosSelecionados =
    idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));

  const alternarTodos = () => {
    setConfirmandoLote(false);
    setSelecionados((atuais) => {
      if (todosSelecionados) {
        return new Set([...atuais].filter((id) => !idsVisiveis.includes(id)));
      }

      return new Set([...atuais, ...idsVisiveis]);
    });
  };

  const alternarLinha = (id: string) => {
    setConfirmandoLote(false);
    setSelecionados((atuais) => {
      const proximos = new Set(atuais);
      if (proximos.has(id)) {
        proximos.delete(id);
      } else {
        proximos.add(id);
      }
      return proximos;
    });
  };

  const removerLinhaDaTela = (id: string) => {
    setLinhas((atuais) => atuais.filter((registro) => registro.id !== id));
    setSelecionados((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(id);
      return proximos;
    });
  };

  const excluirSelecionados = () => {
    const ids = [...selecionados];
    setErro(undefined);

    iniciarExclusaoLote(async () => {
      const resultado = await removerHistoricos(ids);

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      setLinhas((atuais) => atuais.filter((registro) => !ids.includes(registro.id)));
      setSelecionados(new Set());
      setConfirmandoLote(false);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {erro && <AvisoErro mensagem={erro} />}

      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {quantidadeSelecionada > 0
            ? `${quantidadeSelecionada} histórico(s) selecionado(s)`
            : 'Selecione históricos para excluir em lote.'}
        </p>

        {quantidadeSelecionada > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Botao
              type="button"
              variante="sutil"
              tamanho="sm"
              onClick={() => {
                setSelecionados(new Set());
                setConfirmandoLote(false);
              }}
            >
              <X aria-hidden />
              Limpar seleção
            </Botao>

            {!confirmandoLote ? (
              <Botao
                type="button"
                variante="perigo"
                tamanho="sm"
                onClick={() => setConfirmandoLote(true)}
              >
                <Trash2 aria-hidden />
                Excluir selecionados
              </Botao>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destrutivo-suave px-3 py-2 text-xs text-destructive">
                Confirmar exclusão?
                <button
                  type="button"
                  disabled={excluindoLote}
                  onClick={excluirSelecionados}
                  className="font-semibold underline-offset-4 hover:underline disabled:opacity-50"
                >
                  sim
                </button>
                <button
                  type="button"
                  disabled={excluindoLote}
                  onClick={() => setConfirmandoLote(false)}
                  className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
                >
                  não
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <Cartao>
        <TabelaRolavel>
          <TabelaCabecalho>
            <TabelaColuna className="w-0">
              <label className="flex size-5 items-center justify-center">
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  onChange={alternarTodos}
                  className="size-4 rounded border-input accent-primary"
                  aria-label="Selecionar todos os históricos desta página"
                />
              </label>
            </TabelaColuna>
            <TabelaColuna>Data</TabelaColuna>
            <TabelaColuna>Responsável</TabelaColuna>
            <TabelaColuna>Ação</TabelaColuna>
            <TabelaColuna>Registro</TabelaColuna>
            <TabelaColuna>Resumo</TabelaColuna>
            <TabelaColuna className="w-0 text-right">Ações</TabelaColuna>
          </TabelaCabecalho>
          <TabelaCorpo>
            {linhas.map((registro) => (
              <TabelaLinha
                key={registro.id}
                className={selecionados.has(registro.id) ? 'bg-accent/45' : undefined}
              >
                <TabelaCelula className="w-0">
                  <label className="flex size-5 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selecionados.has(registro.id)}
                      onChange={() => alternarLinha(registro.id)}
                      className="size-4 rounded border-input accent-primary"
                      aria-label={`Selecionar histórico: ${registro.resumo}`}
                    />
                  </label>
                </TabelaCelula>
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
                    onSucesso={() => removerLinhaDaTela(registro.id)}
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
  onSucesso,
}: {
  id: string;
  resumo: string;
  onErro: (erro?: string) => void;
  onSucesso: () => void;
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
            onSucesso();
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
