'use client';

import { Mail, Phone, Plus, Tag, X } from 'lucide-react';
import { useId, useRef, useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
import { mascararTelefone } from '@/lib/mascaras';
import { cn } from '@/lib/utils';
import { adicionarLead } from './acoes-lead';

/**
 * "Novo lead" dentro do cartão do CRM.
 *
 * ## Por que o cadastro acontece aqui
 *
 * O cartão de leads é onde se olha quem chegou — e é no mesmo instante que
 * chega mais um. Mandar a pessoa para outra tela para registrar a ligação que
 * está acontecendo é o atrito que faz o lead virar anotação em papel.
 *
 * Começa como botão e vira formulário no clique, como o "adicionar cartão" do
 * funil. Um formulário sempre aberto empurraria a lista para baixo e faria o
 * cartão parecer um cadastro, não uma fila.
 *
 * ## Por que só quatro campos
 *
 * Nome é o único obrigatório; telefone, e-mail e origem entram se quem atende
 * tiver. A ficha completa — documento, observações, etiquetas, campos
 * personalizados — fica na tela do cliente, para depois. Cada campo a mais aqui
 * é atrito no momento em que a pessoa está com pressa, e quem está com pressa
 * simplesmente não registra.
 *
 * Depois de salvar, o formulário se limpa e **continua aberto**: quem registra
 * um lead costuma registrar três seguidos.
 */
export function NovoLead({ origensConhecidas }: { origensConhecidas: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [origem, setOrigem] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvo, setSalvo] = useState<string>();
  const [salvando, iniciar] = useTransition();

  const campo = useRef<HTMLInputElement>(null);
  const idNome = useId();
  const idOrigens = useId();

  function fechar(): void {
    setAberto(false);
    setNome('');
    setTelefone('');
    setEmail('');
    setOrigem('');
    setErro(undefined);
    setSalvo(undefined);
  }

  function salvar(): void {
    if (nome.trim().length < 2) {
      setErro('Informe o nome do lead.');
      return;
    }

    iniciar(async () => {
      setErro(undefined);
      setSalvo(undefined);

      const resultado = await adicionarLead({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        origem: origem.trim(),
      });

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      setSalvo(`${nome.trim()} entrou na fila.`);
      setNome('');
      setTelefone('');
      setEmail('');
      // A origem permanece: quem cadastra três leads da mesma campanha não
      // deveria digitá-la três vezes.
      campo.current?.focus();
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          // O foco vai para o campo no próximo quadro, quando ele já existe.
          requestAnimationFrame(() => campo.current?.focus());
        }}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
      >
        <Plus aria-hidden className="size-3.5" />
        Novo lead
      </button>
    );
  }

  return (
    <div className="bg-muted/30 flex w-full flex-col gap-2 rounded-md border p-2">
      <label className="sr-only" htmlFor={idNome}>
        Nome do lead
      </label>

      <input
        id={idNome}
        ref={campo}
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        onKeyDown={(evento) => {
          // Enter salva, Esc desiste — como em qualquer campo rápido.
          if (evento.key === 'Enter') {
            evento.preventDefault();
            salvar();
          }
          if (evento.key === 'Escape') fechar();
        }}
        placeholder="Nome do lead"
        disabled={salvando}
        aria-invalid={Boolean(erro)}
        className={cn(estilosControle, 'h-9')}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <CampoCompacto icone={Phone} rotulo="Telefone">
          <input
            value={telefone}
            onChange={(evento) => setTelefone(evento.target.value)}
            onBlur={(evento) => setTelefone(mascararTelefone(evento.target.value))}
            onKeyDown={(evento) => evento.key === 'Enter' && salvar()}
            placeholder="Telefone"
            disabled={salvando}
            inputMode="tel"
            className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </CampoCompacto>

        <CampoCompacto icone={Mail} rotulo="E-mail">
          <input
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            onKeyDown={(evento) => evento.key === 'Enter' && salvar()}
            placeholder="E-mail"
            disabled={salvando}
            inputMode="email"
            className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </CampoCompacto>

        <CampoCompacto icone={Tag} rotulo="Origem">
          {/*
            As origens já usadas viram sugestão: é o que mantém "Instagram" e
            "instagram" sendo a mesma linha no resumo por canal. Continua sendo
            campo livre — a lista sugere, não obriga.
          */}
          <input
            value={origem}
            onChange={(evento) => setOrigem(evento.target.value)}
            onKeyDown={(evento) => evento.key === 'Enter' && salvar()}
            placeholder="Origem"
            disabled={salvando}
            list={origensConhecidas.length > 0 ? idOrigens : undefined}
            className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </CampoCompacto>

        {origensConhecidas.length > 0 && (
          <datalist id={idOrigens}>
            {origensConhecidas.map((conhecida) => (
              <option key={conhecida} value={conhecida} />
            ))}
          </datalist>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}

      {/*
        O aviso de sucesso é discreto e some no próximo envio. Ele existe porque
        o formulário se limpa sozinho: sem uma confirmação, o campo em branco
        pode parecer que nada foi salvo.
      */}
      {salvo && !erro && (
        <p role="status" className="text-sucesso text-xs">
          {salvo}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Botao tamanho="sm" onClick={salvar} carregando={salvando}>
          Adicionar
        </Botao>

        <Botao variante="sutil" tamanho="sm" onClick={fechar} aria-label="Fechar">
          <X aria-hidden />
        </Botao>
      </div>
    </div>
  );
}

function CampoCompacto({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: typeof Phone;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="focus-within:border-ring focus-within:ring-ring/20 bg-background flex h-8 items-center gap-2 rounded-md border px-2 transition-[border-color,box-shadow] focus-within:ring-2">
      <Icone aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
      <span className="sr-only">{rotulo}</span>
      {children}
    </label>
  );
}
