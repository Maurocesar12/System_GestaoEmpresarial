'use client';

import { hojeISO } from '@gestao/shared-types';
import { AlignLeft, Check, Phone } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
import { formatarDataCompleta } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { anotarNoCartao, salvarCartao } from './acoes-cartao';

/** As partes do cartão aberto do funil: título editável, descrição e histórico. */

export function Informacao({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: typeof Phone;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      <span className="text-muted-foreground flex h-10 items-center gap-2 text-sm">
        <Icone aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{children}</span>
      </span>
    </div>
  );
}

/**
 * Nome editável no cabeçalho.
 *
 * Clicar transforma o título em campo, como no Trello. O texto não vira um
 * `<input>` permanente porque um campo de formulário no lugar de um título faz
 * a janela parecer um formulário — e a maioria das aberturas é para ler, não
 * para editar.
 */
export function TituloEditavel({
  clienteId,
  nomeInicial,
  observacoes,
}: {
  clienteId: string;
  nomeInicial: string;
  observacoes: string;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(nomeInicial);
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();

  function salvar(): void {
    const limpo = nome.trim();

    if (limpo === nomeInicial) {
      setEditando(false);
      return;
    }

    iniciar(async () => {
      const resultado = await salvarCartao(clienteId, { nome: limpo, observacoes });

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      setErro(undefined);
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="hover:bg-accent -mx-1 rounded px-1 text-left text-lg font-semibold tracking-tight transition-colors"
      >
        {nome}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') salvar();
          if (evento.key === 'Escape') {
            setNome(nomeInicial);
            setEditando(false);
          }
        }}
        onBlur={salvar}
        disabled={salvando}
        className={cn(estilosControle, 'h-9 text-lg font-semibold')}
      />
      {erro && <p className="text-destructive text-xs">{erro}</p>}
    </div>
  );
}

/**
 * Descrição do cartão — as observações do cliente.
 *
 * É o mesmo campo que a ficha do cliente edita: não existe uma "descrição do
 * cartão" separada, e criar uma significaria dois textos sobre a mesma pessoa,
 * cada um contando metade da história.
 */
export function EsqueletoDescricao() {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AlignLeft aria-hidden className="text-muted-foreground size-4" />
        Descrição
      </h3>
      <div className="bg-muted h-20 animate-pulse rounded-md" />
    </section>
  );
}

export function Descricao({
  clienteId,
  nome,
  valorInicial,
}: {
  clienteId: string;
  nome: string;
  valorInicial: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valorInicial);
  const [salvo, setSalvo] = useState(valorInicial);
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();

  function salvar(): void {
    iniciar(async () => {
      const resultado = await salvarCartao(clienteId, { nome, observacoes: texto.trim() });

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      setErro(undefined);
      setSalvo(texto.trim());
      setEditando(false);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AlignLeft aria-hidden className="text-muted-foreground size-4" />
        Descrição
      </h3>

      {editando ? (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            rows={5}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              // Esc desiste. Enter **não** salva aqui: descrição tem parágrafos,
              // e quebrar linha é mais frequente do que concluir.
              if (evento.key === 'Escape') {
                setTexto(salvo);
                setEditando(false);
              }
            }}
            placeholder="O que é importante lembrar sobre este cliente? Preferências, contexto da negociação, combinados."
            className={cn(estilosControle, 'py-2')}
          />

          {erro && <p className="text-destructive text-xs">{erro}</p>}

          <div className="flex items-center gap-2">
            <Botao tamanho="sm" onClick={salvar} carregando={salvando}>
              <Check aria-hidden />
              Salvar
            </Botao>
            <Botao
              variante="sutil"
              tamanho="sm"
              onClick={() => {
                setTexto(salvo);
                setEditando(false);
              }}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className={cn(
            'hover:bg-accent w-full rounded-md px-3 py-2.5 text-left text-sm whitespace-pre-wrap transition-colors',
            salvo ? 'bg-superficie' : 'bg-superficie text-muted-foreground',
          )}
        >
          {salvo || 'Adicionar uma descrição mais detalhada…'}
        </button>
      )}
    </section>
  );
}

/**
 * Histórico de atendimentos — o equivalente aos comentários do Trello.
 *
 * Fica dentro do cartão porque a conversa sobre a negociação acontece enquanto
 * se olha para ela. Mandar o usuário para a ficha do cliente só para anotar
 * "liguei, sem resposta" faria a anotação não acontecer.
 */
export function EsqueletoHistorico() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Histórico de atendimento</h3>
      <div className="bg-muted h-12 animate-pulse rounded-md" />
    </section>
  );
}

export function Historico({
  clienteId,
  iniciais,
}: {
  clienteId: string;
  iniciais: { id: string; descricao: string; data: string }[];
}) {
  // A lista vive aqui e cresce a cada anotação. Ela não pode vir só do
  // servidor: este componente é de cliente e carregou o histórico uma vez, então
  // um `revalidatePath` não o alcança — a anotação seria gravada sem aparecer.
  const [atendimentos, setAtendimentos] = useState(iniciais);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();

  function anotar(): void {
    if (texto.trim().length < 3) {
      setErro('Descreva o que foi feito');
      return;
    }

    iniciar(async () => {
      const resultado = await anotarNoCartao(clienteId, {
        descricao: texto.trim(),
        data: hojeISO(),
      });

      if (resultado.erro || !resultado.atendimento) {
        setErro(resultado.erro ?? 'Não foi possível registrar.');
        return;
      }

      // No topo: o histórico vem do mais recente para o mais antigo, como a
      // API o devolve.
      setAtendimentos((atual) => [resultado.atendimento!, ...atual]);
      setErro(undefined);
      setTexto('');
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Histórico de atendimento</h3>

      <div className="flex flex-col gap-2">
        <textarea
          rows={2}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Liguei, ficou de retornar amanhã…"
          className={cn(estilosControle, 'py-2')}
        />

        {erro && (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        )}

        <div>
          <Botao tamanho="sm" onClick={anotar} carregando={salvando} disabled={!texto.trim()}>
            Registrar
          </Botao>
        </div>
      </div>

      {atendimentos.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum atendimento registrado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {atendimentos.map((atendimento) => (
            <li key={atendimento.id} className="bg-superficie rounded-md px-3 py-2">
              <p className="text-sm whitespace-pre-wrap">{atendimento.descricao}</p>
              <p className="text-muted-foreground numerico mt-1 text-xs">
                {formatarDataCompleta(atendimento.data)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
