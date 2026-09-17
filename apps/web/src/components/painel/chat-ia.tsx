'use client';

import { ArrowUpRight, LifeBuoy, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  LIMITE_HISTORICO_CHAT,
  type CapacidadesChat,
  type MensagemChat,
  type ReferenciaAjuda,
} from '@gestao/shared-types';
import { carregarCapacidadesDoChat, perguntarParaIa } from '@/app/painel/chat-ia-acoes';
import { Botao } from '@/components/ui/botao';
import { TextoDoChat } from './texto-do-chat';

interface Mensagem {
  id: number;
  autor: 'usuario' | 'ia';
  texto: string;
  referencias?: ReferenciaAjuda[];
}

/**
 * A janela de conversa do painel.
 *
 * ## Duas conversas, uma janela
 *
 * O plano da empresa decide o que abre aqui: a **ajuda do sistema**, que
 * explica as telas e não toca nos dados, ou o **assistente com IA**, que
 * conversa sobre os números do negócio. Quem decide é o servidor — a tela
 * pergunta, e é por isso que ela abre sem nome fixo e só se apresenta depois de
 * `capacidades` responder.
 *
 * ## Por que o histórico mora aqui
 *
 * Nada da conversa é guardado no servidor. As últimas mensagens sobem junto com
 * a pergunta, o que dá continuidade ("e no mês passado?") sem criar mais um
 * lugar onde dado de empresa fica armazenado.
 */
export function ChatIa() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [capacidades, setCapacidades] = useState<CapacidadesChat | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [pendente, iniciar] = useTransition();
  const proximoId = useRef(1);
  const fimDaLista = useRef<HTMLDivElement>(null);

  // As capacidades são buscadas na primeira abertura, e não na montagem: quem
  // nunca abre o chat não deveria pagar uma requisição por isso em toda tela.
  useEffect(() => {
    if (!aberto || capacidades) return;

    let valido = true;

    void carregarCapacidadesDoChat().then((resposta) => {
      if (!valido || !resposta.dados) return;

      setCapacidades(resposta.dados);
      setSugestoes(resposta.dados.sugestoes);
      setMensagens([{ id: proximoId.current++, autor: 'ia', texto: resposta.dados.saudacao }]);
    });

    return () => {
      valido = false;
    };
  }, [aberto, capacidades]);

  // Rola para a última mensagem: sem isso, a resposta nova nasce fora da área
  // visível e parece que nada aconteceu.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: 'end' });
  }, [mensagens, pendente]);

  function enviar(pergunta = texto) {
    const mensagem = pergunta.trim();
    if (!mensagem || pendente) return;

    const idUsuario = proximoId.current++;
    const idResposta = proximoId.current++;
    setTexto('');
    setMensagens((atuais) => [...atuais, { id: idUsuario, autor: 'usuario', texto: mensagem }]);

    const historico = paraHistorico(mensagens);

    iniciar(async () => {
      const resposta = await perguntarParaIa(mensagem, historico);

      setMensagens((atuais) => [
        ...atuais,
        {
          id: idResposta,
          autor: 'ia',
          texto: resposta.dados?.resposta ?? resposta.erro ?? 'Não consegui responder agora.',
          referencias: resposta.dados?.referencias,
        },
      ]);

      if (resposta.dados?.sugestoes.length) setSugestoes(resposta.dados.sugestoes);
    });
  }

  const modoIa = capacidades?.modo === 'ia';
  const Icone = modoIa ? Sparkles : LifeBuoy;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {aberto && (
        <section
          aria-label={capacidades?.titulo ?? 'Assistente'}
          className="bg-card text-card-foreground animate-in slide-in-from-bottom-2 fade-in flex h-[min(38rem,calc(100vh-7rem))] w-[min(calc(100vw-2rem),25rem)] flex-col overflow-hidden rounded-xl border shadow-[var(--sombra-media)] duration-200"
        >
          <header className="from-primary/8 flex items-center justify-between gap-3 border-b bg-gradient-to-br to-transparent px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icone aria-hidden className="size-4.5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm leading-tight font-semibold">
                  {capacidades?.titulo ?? 'Assistente'}
                </h2>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate text-xs">
                  {capacidades ? (
                    <>
                      <span aria-hidden className="bg-sucesso size-1.5 shrink-0 rounded-full" />
                      {capacidades.descricao}
                    </>
                  ) : (
                    'carregando…'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar assistente"
              className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
            >
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {mensagens.map((mensagem) =>
              mensagem.autor === 'usuario' ? (
                <p
                  key={mensagem.id}
                  className="bg-primary text-primary-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap"
                >
                  {mensagem.texto}
                </p>
              ) : (
                <div key={mensagem.id} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                  >
                    <Icone className="size-3.5" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="bg-muted/60 text-foreground rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-sm break-words">
                      <TextoDoChat texto={mensagem.texto} />
                    </div>

                    {mensagem.referencias && mensagem.referencias.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {mensagem.referencias.map((referencia) => (
                          <li key={referencia.href}>
                            <Link
                              href={referencia.href}
                              onClick={() => setAberto(false)}
                              className="border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                            >
                              {referencia.titulo}
                              <ArrowUpRight aria-hidden className="size-3" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ),
            )}

            {pendente && (
              <div className="flex gap-2.5">
                <span
                  aria-hidden
                  className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                >
                  <Icone className="size-3.5" />
                </span>
                <div
                  role="status"
                  className="bg-muted/60 text-muted-foreground flex items-center gap-2 rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-xs"
                >
                  <span aria-hidden className="flex gap-1">
                    <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                    <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                    <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" />
                  </span>
                  {modoIa ? 'Analisando os seus números…' : 'Procurando na ajuda…'}
                </div>
              </div>
            )}

            {capacidades?.convite && mensagens.length <= 1 && (
              <div className="bg-muted/40 rounded-lg border border-dashed px-3 py-2.5">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {capacidades.convite}
                </p>
                <Link
                  href="/painel/plano"
                  onClick={() => setAberto(false)}
                  className="text-primary mt-1.5 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                >
                  Ver o Premium
                  <ArrowUpRight aria-hidden className="size-3" />
                </Link>
              </div>
            )}

            <div ref={fimDaLista} />
          </div>

          <div className="bg-muted/20 border-t px-4 py-3">
            {sugestoes.length > 0 && (
              <div className="mb-3">
                {/* O rótulo existe porque, sem ele, as pílulas parecem enfeite.
                    Dizer que são perguntas prontas é o que faz alguém clicar. */}
                <p className="text-muted-foreground mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
                  Perguntas frequentes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sugestoes.map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      disabled={pendente}
                      onClick={() => enviar(sugestao)}
                      className="border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground rounded-full border px-2.5 py-1 text-left text-xs transition-colors disabled:opacity-50"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              className="flex items-end gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                enviar();
              }}
            >
              <label className="sr-only" htmlFor="chat-ia-mensagem">
                Escreva sua pergunta
              </label>
              <textarea
                id="chat-ia-mensagem"
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' && !evento.shiftKey) {
                    evento.preventDefault();
                    enviar();
                  }
                }}
                placeholder={modoIa ? 'Pergunte sobre caixa, funil, agenda…' : 'Como faço para…?'}
                rows={1}
                className="border-input bg-card focus-visible:ring-ring focus-visible:border-ring max-h-24 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2"
              />
              <Botao
                type="submit"
                tamanho="icone"
                carregando={pendente}
                aria-label="Enviar pergunta"
              >
                <Send aria-hidden />
              </Botao>
            </form>
          </div>
        </section>
      )}

      {/* Aberto, o botão vira só um X: o nome do assistente já está no
          cabeçalho do painel, e repeti-lo logo abaixo é ruído. */}
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
        className={`bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex h-12 items-center gap-2 rounded-full text-sm font-medium shadow-[var(--sombra-media)] transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
          aberto ? 'w-12 justify-center' : 'px-4'
        }`}
      >
        {aberto ? (
          <X aria-hidden className="size-5" />
        ) : (
          <>
            <Icone aria-hidden className="size-4" />
            {capacidades?.titulo ?? 'Ajuda'}
            <MessageCircle aria-hidden className="size-4 opacity-70" />
          </>
        )}
      </button>
    </div>
  );
}

/**
 * As mensagens no formato do contrato, já cortadas no limite.
 *
 * A saudação inicial fica de fora: ela é texto da tela, não algo que alguém
 * tenha dito, e repeti-la ao modelo só gastaria contexto.
 */
function paraHistorico(mensagens: Mensagem[]): MensagemChat[] {
  return mensagens
    .slice(1)
    .slice(-LIMITE_HISTORICO_CHAT)
    .map((mensagem) => ({
      autor: mensagem.autor === 'usuario' ? ('usuario' as const) : ('assistente' as const),
      texto: mensagem.texto.slice(0, 4_000),
    }));
}
