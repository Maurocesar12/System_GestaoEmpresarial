'use client';

import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { perguntarParaIa } from '@/app/painel/chat-ia-acoes';
import { Botao } from '@/components/ui/botao';

interface Mensagem {
  id: number;
  autor: 'usuario' | 'ia';
  texto: string;
}

const MENSAGEM_INICIAL: Mensagem = {
  id: 1,
  autor: 'ia',
  texto:
    'Olá! Sou a IA gratuita do sistema. Posso resumir caixa, clientes, orçamentos, agenda e follow-ups com base nos seus dados.',
};

const SUGESTOES_INICIAIS = [
  'Como está meu caixa este mês?',
  'Resumo dos clientes e orçamentos',
  'Tenho follow-ups atrasados?',
];

export function ChatIa() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([MENSAGEM_INICIAL]);
  const [sugestoes, setSugestoes] = useState(SUGESTOES_INICIAIS);
  const [pendente, iniciar] = useTransition();
  const proximoId = useRef(2);

  function enviar(pergunta = texto) {
    const mensagem = pergunta.trim();
    if (!mensagem || pendente) return;

    const idUsuario = proximoId.current++;
    const idIa = proximoId.current++;
    setTexto('');
    setMensagens((atuais) => [...atuais, { id: idUsuario, autor: 'usuario', texto: mensagem }]);

    iniciar(async () => {
      const resposta = await perguntarParaIa(mensagem);
      setMensagens((atuais) => [
        ...atuais,
        {
          id: idIa,
          autor: 'ia',
          texto: resposta.dados?.resposta ?? resposta.erro ?? 'Não consegui responder agora.',
        },
      ]);
      if (resposta.dados?.sugestoes.length) setSugestoes(resposta.dados.sugestoes);
    });
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {aberto && (
        <section
          aria-label="Chat com IA"
          className="bg-card text-card-foreground flex h-[34rem] w-[min(calc(100vw-2rem),24rem)] flex-col overflow-hidden rounded-lg border shadow-[var(--sombra-media)]"
        >
          <header className="flex items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                <Bot aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">IA gratuita</h2>
                <p className="text-muted-foreground truncate text-xs">Assistente do painel</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar chat"
              className="hover:bg-accent rounded-md p-1.5 transition-colors"
            >
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {mensagens.map((mensagem) => (
              <div
                key={mensagem.id}
                className={`flex ${mensagem.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}
              >
                <p
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    mensagem.autor === 'usuario'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {mensagem.texto}
                </p>
              </div>
            ))}
            {pendente && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Pensando com os dados do painel...
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3">
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

            <form
              className="flex items-end gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                enviar();
              }}
            >
              <label className="sr-only" htmlFor="chat-ia-mensagem">
                Pergunte para a IA
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
                placeholder="Pergunte sobre caixa, clientes, agenda..."
                rows={1}
                className="border-input bg-background max-h-24 min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        aria-label={aberto ? 'Fechar chat com IA' : 'Abrir chat com IA'}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-[var(--sombra-media)] transition-colors"
      >
        <Sparkles aria-hidden className="size-4" />
        IA gratuita
        <MessageCircle aria-hidden className="size-4" />
      </button>
    </div>
  );
}
