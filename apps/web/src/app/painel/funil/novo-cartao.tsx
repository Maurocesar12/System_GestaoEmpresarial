'use client';

import type { Etiqueta } from '@gestao/shared-types';
import { Mail, Phone, Plus, Tag, X } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
import { estilosEtiqueta } from '@/lib/etiquetas';
import { mascararTelefone } from '@/lib/mascaras';
import { cn } from '@/lib/utils';
import { adicionarCartao } from './acoes';

/**
 * "Adicionar cliente" no rodapé da coluna.
 *
 * Começa como um link discreto e vira formulário no clique — o padrão do
 * Trello. O motivo de não ser um formulário sempre aberto: em sete colunas,
 * seriam sete caixas de texto competindo com os cartões, e o quadro deixaria de
 * parecer um quadro.
 *
 * Pede só o nome. Quem está olhando o funil quer registrar o lead que acabou de
 * ligar, não preencher ficha; telefone, e-mail e o resto ficam para a página do
 * cliente. Um campo a mais aqui é atrito no momento em que a pessoa está com
 * pressa.
 */
export function NovoCartao({
  etapaId,
  etapaNome,
  etiquetas,
}: {
  etapaId: string;
  etapaNome: string;
  etiquetas: Etiqueta[];
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [origem, setOrigem] = useState('');
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();

  const campo = useRef<HTMLInputElement>(null);

  function fechar(): void {
    setAberto(false);
    setNome('');
    setTelefone('');
    setEmail('');
    setOrigem('');
    setEtiquetasSelecionadas([]);
    setErro(undefined);
  }

  function salvar(): void {
    if (nome.trim().length < 2) {
      setErro('Informe o nome do cliente');
      return;
    }

    iniciar(async () => {
      setErro(undefined);

      const resultado = await adicionarCartao(etapaId, {
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        documento: null,
        observacoes: null,
        origem: origem.trim() || null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        camposPersonalizados: {},
        etiquetas: etiquetasSelecionadas,
      });

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      // Limpa e mantém aberto: quem cadastra um lead costuma cadastrar três.
      // Reabrir o formulário a cada nome seria um clique por cliente.
      setNome('');
      setTelefone('');
      setEmail('');
      setOrigem('');
      setEtiquetasSelecionadas([]);
      campo.current?.focus();
    });
  }

  function alternarEtiqueta(etiquetaId: string): void {
    setEtiquetasSelecionadas((atuais) =>
      atuais.includes(etiquetaId)
        ? atuais.filter((id) => id !== etiquetaId)
        : [...atuais, etiquetaId],
    );
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
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors"
      >
        <Plus aria-hidden className="size-4" />
        Adicionar cliente
      </button>
    );
  }

  return (
    <div className="bg-card flex flex-col gap-2 rounded-lg border p-2 shadow-[var(--sombra-sutil)]">
      <label className="sr-only" htmlFor={`novo-${etapaId}`}>
        Nome do cliente para a etapa {etapaNome}
      </label>

      <input
        id={`novo-${etapaId}`}
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
        placeholder="Nome do cliente"
        disabled={salvando}
        aria-invalid={Boolean(erro)}
        className={cn(estilosControle, 'h-9 bg-card')}
      />

      <CampoCompacto icone={Phone} rotulo="Telefone">
        <input
          value={telefone}
          onChange={(evento) => setTelefone(evento.target.value)}
          onBlur={(evento) => setTelefone(mascararTelefone(evento.target.value))}
          placeholder="Telefone"
          disabled={salvando}
          className="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </CampoCompacto>

      <CampoCompacto icone={Mail} rotulo="E-mail">
        <input
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          placeholder="E-mail"
          disabled={salvando}
          className="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </CampoCompacto>

      <CampoCompacto icone={Tag} rotulo="Origem">
        <input
          value={origem}
          onChange={(evento) => setOrigem(evento.target.value)}
          placeholder="Origem"
          disabled={salvando}
          className="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </CampoCompacto>

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {etiquetas.map((etiqueta) => {
            const selecionada = etiquetasSelecionadas.includes(etiqueta.id);
            return (
              <button
                key={etiqueta.id}
                type="button"
                onClick={() => alternarEtiqueta(etiqueta.id)}
                aria-pressed={selecionada}
                className={cn(
                  'max-w-full rounded-[5px] border px-2.5 py-1 text-[0.6875rem] font-semibold transition-[box-shadow,opacity,transform]',
                  selecionada
                    ? 'opacity-100 shadow-[var(--sombra-sutil)]'
                    : 'opacity-70 hover:-translate-y-0.5 hover:opacity-100',
                )}
                style={estilosEtiqueta(etiqueta.cor, selecionada)}
                title={etiqueta.nome}
              >
                <span className="block truncate">{etiqueta.nome}</span>
              </button>
            );
          })}
        </div>
      )}

      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Botao tamanho="sm" onClick={salvar} carregando={salvando}>
          Adicionar
        </Botao>

        {/* `sm` e não `icone`: o quadrado de 40px ficaria maior que o botão
            "Adicionar" ao lado. */}
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
    <label className="focus-within:border-ring focus-within:ring-ring/20 flex h-8 items-center gap-2 rounded-md border bg-background px-2 transition-[border-color,box-shadow] focus-within:ring-2">
      <Icone aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
      <span className="sr-only">{rotulo}</span>
      {children}
    </label>
  );
}
