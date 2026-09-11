'use client';

import { Trash2, X } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { LIMITE_EXCLUSAO_HISTORICO } from '@gestao/shared-types';
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

/**
 * Listagem do histórico, com exclusão individual e em lote.
 *
 * As linhas vêm do servidor e ficam assim: excluir revalida a rota, e é a
 * resposta do servidor que tira a linha da tela. Guardar uma cópia em estado
 * local pareceria mais rápido, mas passaria a mostrar uma lista que só este
 * navegador enxerga — sem o registro da própria exclusão, que a auditoria
 * grava, e sem o que outra pessoa apagou com a página aberta.
 */
export function TabelaHistorico({
  registros,
  podeExcluir,
}: {
  registros: LinhaHistorico[];
  /** Sem a permissão, a tabela vira só leitura: nem caixas, nem botões. */
  podeExcluir: boolean;
}) {
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(() => new Set());
  const [erro, setErro] = useState<string>();
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [excluindoLote, iniciarExclusaoLote] = useTransition();

  // A seleção é sempre filtrada pelo que está na tela agora. Excluir ou trocar
  // de página deixa ids para trás no conjunto, e eles não podem contar no
  // rodapé nem voltar numa exclusão seguinte.
  const idsSelecionados = useMemo(
    () => registros.map((registro) => registro.id).filter((id) => selecionados.has(id)),
    [registros, selecionados],
  );
  const quantidadeSelecionada = idsSelecionados.length;
  const todosSelecionados = registros.length > 0 && quantidadeSelecionada === registros.length;
  const excedeuLimite = quantidadeSelecionada > LIMITE_EXCLUSAO_HISTORICO;

  const limparSelecao = () => {
    setSelecionados(new Set());
    setConfirmandoLote(false);
  };

  const alternarTodos = () => {
    setConfirmandoLote(false);
    setSelecionados(todosSelecionados ? new Set() : new Set(registros.map(({ id }) => id)));
  };

  const alternarLinha = (id: string) => {
    setConfirmandoLote(false);
    setSelecionados((atuais) => {
      const proximos = new Set(atuais);

      if (!proximos.delete(id)) {
        proximos.add(id);
      }

      return proximos;
    });
  };

  const excluirSelecionados = () => {
    setErro(undefined);

    iniciarExclusaoLote(async () => {
      const resultado = await removerHistoricos(idsSelecionados);

      // A seleção é limpa mesmo quando dá erro: as linhas que sobraram chegam
      // de novo do servidor, e reaproveitar ids antigos tentaria excluir o que
      // já saiu.
      limparSelecao();

      if (resultado.erro) {
        setErro(resultado.erro);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {erro && <AvisoErro mensagem={erro} />}

      {podeExcluir && (
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
                disabled={excluindoLote}
                onClick={limparSelecao}
              >
                <X aria-hidden />
                Limpar seleção
              </Botao>

              {!confirmandoLote ? (
                <Botao
                  type="button"
                  variante="perigo"
                  tamanho="sm"
                  disabled={excedeuLimite}
                  onClick={() => setConfirmandoLote(true)}
                >
                  <Trash2 aria-hidden />
                  Excluir selecionados
                </Botao>
              ) : (
                <span
                  role="alertdialog"
                  aria-label="Confirmar exclusão dos históricos selecionados"
                  className="border-destructive/30 bg-destrutivo-suave text-destructive inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
                >
                  Excluir {quantidadeSelecionada} registro(s)?
                  <Botao
                    type="button"
                    variante="perigo"
                    tamanho="sm"
                    carregando={excluindoLote}
                    onClick={excluirSelecionados}
                  >
                    Excluir
                  </Botao>
                  <Botao
                    type="button"
                    variante="sutil"
                    tamanho="sm"
                    disabled={excluindoLote}
                    onClick={() => setConfirmandoLote(false)}
                  >
                    Cancelar
                  </Botao>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {excedeuLimite && (
        <p className="text-muted-foreground text-xs">
          Selecione no máximo {LIMITE_EXCLUSAO_HISTORICO} registros por vez.
        </p>
      )}

      <Cartao>
        <TabelaRolavel>
          <TabelaCabecalho>
            {podeExcluir && (
              <TabelaColuna className="w-0">
                <label className="flex size-5 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    disabled={registros.length === 0 || excluindoLote}
                    // Seleção parcial tem marca própria: sem ela o quadrado fica
                    // vazio e some a informação de que há linhas marcadas.
                    ref={(elemento) => {
                      if (elemento) {
                        elemento.indeterminate = quantidadeSelecionada > 0 && !todosSelecionados;
                      }
                    }}
                    onChange={alternarTodos}
                    className="border-input accent-primary size-4 rounded"
                    aria-label="Selecionar todos os históricos desta página"
                  />
                </label>
              </TabelaColuna>
            )}
            <TabelaColuna>Data</TabelaColuna>
            <TabelaColuna>Responsável</TabelaColuna>
            <TabelaColuna>Ação</TabelaColuna>
            <TabelaColuna>Registro</TabelaColuna>
            <TabelaColuna>Resumo</TabelaColuna>
            {podeExcluir && <TabelaColuna className="w-0 text-right">Ações</TabelaColuna>}
          </TabelaCabecalho>
          <TabelaCorpo>
            {registros.map((registro) => (
              <TabelaLinha
                key={registro.id}
                className={selecionados.has(registro.id) ? 'bg-accent/45' : undefined}
              >
                {podeExcluir && (
                  <TabelaCelula className="w-0">
                    <label className="flex size-5 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selecionados.has(registro.id)}
                        disabled={excluindoLote}
                        onChange={() => alternarLinha(registro.id)}
                        className="border-input accent-primary size-4 rounded"
                        aria-label={`Selecionar histórico: ${registro.resumo}`}
                      />
                    </label>
                  </TabelaCelula>
                )}
                <TabelaCelula suave className="whitespace-nowrap">
                  {registro.data}
                </TabelaCelula>
                <TabelaCelula>{registro.responsavel}</TabelaCelula>
                <TabelaCelula>{registro.acao}</TabelaCelula>
                <TabelaCelula>{registro.registro}</TabelaCelula>
                <TabelaCelula className="min-w-[20rem]">
                  <span className="line-clamp-2">{registro.resumo}</span>
                </TabelaCelula>
                {podeExcluir && (
                  <TabelaCelula className="text-right">
                    <BotaoExcluirHistorico
                      id={registro.id}
                      resumo={registro.resumo}
                      desabilitado={excluindoLote}
                      onErro={setErro}
                    />
                  </TabelaCelula>
                )}
              </TabelaLinha>
            ))}
          </TabelaCorpo>
        </TabelaRolavel>
      </Cartao>
    </div>
  );
}

/**
 * Exclusão de uma linha, com a confirmação no lugar do botão.
 *
 * A confirmação fica na própria linha de propósito: um diálogo no meio da tela
 * esconderia justamente o registro que está prestes a ser apagado.
 */
function BotaoExcluirHistorico({
  id,
  resumo,
  desabilitado,
  onErro,
}: {
  id: string;
  resumo: string;
  desabilitado: boolean;
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
        disabled={desabilitado}
        onClick={() => setConfirmando(true)}
        aria-label={`Excluir histórico: ${resumo}`}
      >
        <Trash2 aria-hidden />
        Excluir
      </Botao>
    );
  }

  const excluir = () => {
    onErro(undefined);

    iniciar(async () => {
      const resultado = await removerHistorico(id);

      // Fecha a confirmação nos dois casos: dando certo, a linha sai inteira na
      // revalidação; dando errado, quem explica é a mensagem no topo, e deixar
      // "Excluir?" aberto convida ao reenvio do que já falhou.
      setConfirmando(false);

      if (resultado.erro) {
        onErro(resultado.erro);
      }
    });
  };

  return (
    <span
      role="alertdialog"
      aria-label={`Confirmar exclusão do histórico: ${resumo}`}
      className="inline-flex items-center justify-end gap-2 whitespace-nowrap"
    >
      <span className="text-muted-foreground text-xs">Excluir?</span>
      <Botao type="button" variante="perigo" tamanho="sm" carregando={excluindo} onClick={excluir}>
        Excluir
      </Botao>
      <Botao
        type="button"
        variante="sutil"
        tamanho="sm"
        disabled={excluindo}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Botao>
    </span>
  );
}
