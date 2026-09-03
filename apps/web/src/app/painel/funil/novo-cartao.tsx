'use client';

import { Plus, X } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { estilosControle } from '@/components/ui/campo';
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
export function NovoCartao({ etapaId, etapaNome }: { etapaId: string; etapaNome: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();

  const campo = useRef<HTMLInputElement>(null);

  function fechar(): void {
    setAberto(false);
    setNome('');
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
        email: null,
        telefone: null,
        documento: null,
        observacoes: null,
        origem: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      });

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      // Limpa e mantém aberto: quem cadastra um lead costuma cadastrar três.
      // Reabrir o formulário a cada nome seria um clique por cliente.
      setNome('');
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
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors"
      >
        <Plus aria-hidden className="size-4" />
        Adicionar cliente
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
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
