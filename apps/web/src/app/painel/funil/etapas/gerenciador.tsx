'use client';

import type { EtapaFunil } from '@gestao/shared-types';
import { useOptimistic, useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { criarEtapa, excluirEtapa, renomearEtapa, reordenarEtapas } from './acoes';

/**
 * Gestão das etapas do funil.
 *
 * A reordenação usa botões de subir e descer, e não arrastar e soltar. São
 * poucas etapas, mexidas raramente, e botões funcionam por teclado, no celular
 * e com leitor de tela sem nenhum trabalho extra — o arrasto exigiria as três
 * coisas separadamente para ganhar pouco.
 *
 * A ordem na tela muda na hora, antes de o servidor confirmar. Reordenar é uma
 * sequência de ajustes até ficar do jeito certo; esperar meio segundo a cada
 * clique tornaria a tarefa penosa.
 */
export function GerenciadorEtapas({ etapas }: { etapas: EtapaFunil[] }) {
  const [erro, setErro] = useState<string>();
  const [, iniciar] = useTransition();

  const [ordem, reordenarOtimista] = useOptimistic(
    etapas,
    (atual, { de, para }: { de: number; para: number }) => {
      const copia = [...atual];
      const [movida] = copia.splice(de, 1);
      if (movida) copia.splice(para, 0, movida);
      return copia;
    },
  );

  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;

    if (destino < 0 || destino >= ordem.length) {
      return;
    }

    setErro(undefined);

    iniciar(async () => {
      reordenarOtimista({ de: indice, para: destino });

      const nova = [...ordem];
      const [movida] = nova.splice(indice, 1);
      if (movida) nova.splice(destino, 0, movida);

      const resultado = await reordenarEtapas(nova.map((etapa) => etapa.id));
      setErro(resultado.erro);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {erro && <AvisoErro mensagem={erro} />}

      <ol className="flex flex-col rounded-lg border">
        {ordem.map((etapa, indice) => (
          <li
            key={etapa.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <LinhaEtapa etapa={etapa} onErro={setErro} />

            <div className="flex items-center gap-1">
              <BotaoOrdem
                rotulo={`Subir ${etapa.nome}`}
                simbolo="↑"
                desabilitado={indice === 0}
                onClick={() => mover(indice, -1)}
              />
              <BotaoOrdem
                rotulo={`Descer ${etapa.nome}`}
                simbolo="↓"
                desabilitado={indice === ordem.length - 1}
                onClick={() => mover(indice, 1)}
              />
            </div>
          </li>
        ))}
      </ol>

      <NovaEtapa onErro={setErro} />
    </div>
  );
}

/** Nome editável e exclusão de uma etapa. */
function LinhaEtapa({ etapa, onErro }: { etapa: EtapaFunil; onErro: (erro?: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(etapa.nome);
  const [salvando, iniciar] = useTransition();

  const salvar = () => {
    // Nada mudou: sair da edição sem gastar uma requisição.
    if (nome.trim() === etapa.nome) {
      setEditando(false);
      return;
    }

    iniciar(async () => {
      onErro(undefined);
      const resultado = await renomearEtapa(etapa.id, nome.trim());

      if (resultado.erro) {
        onErro(resultado.erro);
        setNome(etapa.nome);
      }

      setEditando(false);
    });
  };

  if (editando) {
    return (
      <span className="flex flex-1 items-center gap-2">
        <input
          autoFocus
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={salvar}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') salvar();
            if (evento.key === 'Escape') {
              setNome(etapa.nome);
              setEditando(false);
            }
          }}
          disabled={salvando}
          aria-label={`Nome da etapa ${etapa.nome}`}
          className="focus-visible:ring-ring h-9 max-w-xs flex-1 rounded-md border bg-transparent px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </span>
    );
  }

  return (
    <span className="flex flex-1 items-center gap-3">
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {etapa.nome}
      </button>

      <BotaoExcluir id={etapa.id} nome={etapa.nome} onErro={onErro} />
    </span>
  );
}

function BotaoExcluir({
  id,
  nome,
  onErro,
}: {
  id: string;
  nome: string;
  onErro: (erro?: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
      >
        excluir
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Excluir {nome}?</span>
      <button
        type="button"
        disabled={excluindo}
        onClick={() =>
          iniciar(async () => {
            onErro(undefined);
            const resultado = await excluirEtapa(id);
            onErro(resultado.erro);
            setConfirmando(false);
          })
        }
        className="text-destructive font-medium underline-offset-4 hover:underline disabled:opacity-50"
      >
        sim
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-muted-foreground underline-offset-4 hover:underline"
      >
        não
      </button>
    </span>
  );
}

function BotaoOrdem({
  rotulo,
  simbolo,
  desabilitado,
  onClick,
}: {
  rotulo: string;
  simbolo: string;
  desabilitado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      className="hover:bg-accent focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30"
    >
      {simbolo}
    </button>
  );
}

function NovaEtapa({ onErro }: { onErro: (erro?: string) => void }) {
  const [nome, setNome] = useState('');
  const [criando, iniciar] = useTransition();

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();

    if (!nome.trim()) return;

    iniciar(async () => {
      onErro(undefined);
      const resultado = await criarEtapa({ nome: nome.trim() });

      if (resultado.erro) {
        onErro(resultado.erro);
        return;
      }

      setNome('');
    });
  };

  return (
    <form onSubmit={enviar} method="post" className="flex flex-wrap items-end gap-3">
      <Campo
        rotulo="Nova etapa"
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        placeholder="Ex.: Aguardando peça"
        ajuda="Entra no fim do funil. Reordene depois."
        className="w-64"
      />

      <Botao type="submit" variante="secundario" carregando={criando}>
        Adicionar etapa
      </Botao>
    </form>
  );
}
