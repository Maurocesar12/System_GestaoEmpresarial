'use client';

import {
  ArrowUpRight,
  Bot,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
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
          className="bg-card text-card-foreground flex h-[34rem] w-[min(calc(100vw-2rem),24rem)] flex-col overflow-hidden rounded-lg border shadow-[var(--sombra-media)]"
        >
          <header className="bg-muted/35 flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                <Bot aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">
                  {capacidades?.titulo ?? 'Assistente'}
                </h2>
                <p className="text-muted-foreground truncate text-xs">
                  {capacidades?.descricao ?? 'carregando…'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar assistente"
              className="hover:bg-accent rounded-md p-1.5 transition-colors"
            >
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {mensagens.map((mensagem) => (
              <div
                key={mensagem.id}
                className={`flex flex-col gap-1.5 ${mensagem.autor === 'usuario' ? 'items-end' : 'items-start'}`}
              >
                <p
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    mensagem.autor === 'usuario'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {mensagem.texto}
                </p>

                {mensagem.referencias && mensagem.referencias.length > 0 && (
                  <ul className="flex max-w-[85%] flex-wrap gap-1.5">
                    {mensagem.referencias.map((referencia) => (
                      <li key={referencia.href}>
                        <Link
                          href={referencia.href}
                          onClick={() => setAberto(false)}
                          className="border-border text-muted-foreground hover:bg-accent hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
                        >
                          {referencia.titulo}
                          <ArrowUpRight aria-hidden className="size-3" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {pendente && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {modoIa ? 'Analisando os seus números…' : 'Procurando na ajuda…'}
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

          <div className="border-t px-4 py-3">
            {sugestoes.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {sugestoes.map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => enviar(sugestao)}
                    className="border-border text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full border px-3 py-1 text-xs transition-colors"
                  >
                    {sugestao}
                  </button>
                ))}
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
                className="border-input bg-background focus-visible:ring-ring max-h-24 min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
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

      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-[var(--sombra-media)] transition-colors"
      >
        <Icone aria-hidden className="size-4" />
        {capacidades?.titulo ?? 'Ajuda'}
        <MessageCircle aria-hidden className="size-4" />
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
