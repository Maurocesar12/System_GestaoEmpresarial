'use client';

import { formatarBRL, formatarTelefone, hojeISO, type ClienteNoFunil } from '@gestao/shared-types';
import { AlignLeft, Check, ExternalLink, Mail, Phone, Tag, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
import { Selecao } from '@/components/ui/selecao';
import { formatarDataCompleta } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { anotarNoCartao, carregarCartao, salvarCartao, type DetalheCartao } from './acoes-cartao';

/**
 * O cartão aberto, no estilo do Trello.
 *
 * Usa o `<dialog>` nativo em vez de uma `<div>` com posição fixa. Não é
 * preciosismo: o elemento nativo traz de graça o fechamento com Esc, o foco
 * preso dentro da janela enquanto ela está aberta, o resto da página marcado
 * como inerte para leitores de tela e a camada de fundo (`::backdrop`). Uma
 * reimplementação disso à mão passa de cem linhas e erra o foco em algum caso.
 *
 * O conteúdo é carregado ao abrir, não junto do quadro — observações e
 * histórico de dezenas de clientes seriam baixados para exibir nome e valor.
 */
export function CartaoAberto({
  cliente,
  etapaAtual,
  etapas,
  aoTrocarEtapa,
  aoFechar,
}: {
  cliente: ClienteNoFunil;
  etapaAtual: string;
  etapas: { id: string; nome: string }[];
  aoTrocarEtapa: (etapaId: string) => void;
  aoFechar: () => void;
}) {
  const janela = useRef<HTMLDialogElement>(null);

  const [detalhe, setDetalhe] = useState<DetalheCartao | null>(null);
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(true);

  // `showModal()` só existe no cliente e precisa rodar depois da montagem — é
  // ele que ativa o backdrop, o Esc e a prisão de foco.
  useEffect(() => {
    janela.current?.showModal();
  }, []);

  useEffect(() => {
    let ativo = true;

    void carregarCartao(cliente.id).then((resposta) => {
      // Ignora a resposta se o cartão já foi fechado: escrever estado de um
      // componente desmontado é vazamento e aviso no console.
      if (!ativo) return;

      setDetalhe(resposta.detalhe ?? null);
      setErro(resposta.erro);
      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [cliente.id]);

  return (
    <dialog
      ref={janela}
      onClose={aoFechar}
      // Clicar fora fecha. O alvo do clique é o próprio `<dialog>` apenas
      // quando ele acontece no backdrop — dentro, o alvo é algum filho.
      onClick={(evento) => {
        if (evento.target === janela.current) janela.current?.close();
      }}
      className={cn(
        'bg-card text-card-foreground m-auto w-full max-w-2xl rounded-xl border p-0 shadow-[var(--sombra-media)]',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
      )}
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <TituloEditavel
              clienteId={cliente.id}
              nomeInicial={cliente.nome}
              observacoes={detalhe?.cliente.observacoes ?? ''}
            />

            <p className="text-muted-foreground text-xs">
              na etapa {etapas.find((etapa) => etapa.id === etapaAtual)?.nome}
            </p>
          </div>

          <button
            type="button"
            onClick={() => janela.current?.close()}
            aria-label="Fechar"
            className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}

          <section className="grid gap-3 sm:grid-cols-3">
            <Selecao
              rotulo="Etapa"
              value={etapaAtual}
              onChange={(evento) => aoTrocarEtapa(evento.target.value)}
            >
              {etapas.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </option>
              ))}
            </Selecao>

            <Informacao icone={Phone} rotulo="Telefone">
              {cliente.telefone ? formatarTelefone(cliente.telefone) : '—'}
            </Informacao>

            <Informacao icone={Mail} rotulo="E-mail">
              {cliente.email ?? '—'}
            </Informacao>
          </section>

          {cliente.orcamentoAberto && (
            <section className="bg-superficie flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Tag aria-hidden className="text-primary size-4" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Proposta em aberto</span>
                  {cliente.orcamentoAberto.servicoNome && (
                    <span className="text-muted-foreground text-xs">
                      {cliente.orcamentoAberto.servicoNome}
                    </span>
                  )}
                </div>
              </div>

              <span className="numerico text-lg font-semibold">
                {formatarBRL(cliente.orcamentoAberto.valor)}
              </span>
            </section>
          )}

          {/*
            Só monta depois de os dados chegarem. É o que dispensa sincronizar
            prop com estado por efeito: montando com o valor já em mãos, o
            estado inicial nasce correto e nunca precisa ser corrigido depois.
          */}
          {carregando ? (
            <EsqueletoDescricao />
          ) : (
            <Descricao
              clienteId={cliente.id}
              nome={cliente.nome}
              valorInicial={detalhe?.cliente.observacoes ?? ''}
            />
          )}

          {carregando ? (
            <EsqueletoHistorico />
          ) : (
            <Historico clienteId={cliente.id} iniciais={detalhe?.atendimentos ?? []} />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <Link
            href={`/painel/clientes/${cliente.id}`}
            className={estilosBotao({ variante: 'sutil', tamanho: 'sm' })}
          >
            <ExternalLink aria-hidden />
            Abrir ficha completa
          </Link>

          <Botao variante="secundario" tamanho="sm" onClick={() => janela.current?.close()}>
            Fechar
          </Botao>
        </footer>
      </div>
    </dialog>
  );
}

function Informacao({
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
function TituloEditavel({
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
function EsqueletoDescricao() {
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

function Descricao({
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
function EsqueletoHistorico() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Histórico de atendimento</h3>
      <div className="bg-muted h-12 animate-pulse rounded-md" />
    </section>
  );
}

function Historico({
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
