'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

/**
 * Busca de clientes.
 *
 * Escreve o termo na URL em vez de guardá-lo em estado do React. O resultado é
 * que a busca pode ser compartilhada por link, sobrevive ao recarregar a página
 * e funciona com o botão voltar.
 *
 * O envio é adiado em 400 ms depois da última tecla. Sem essa espera, digitar
 * "maria" dispararia cinco consultas ao banco — uma por letra.
 */
export function CampoBusca({ valorInicial }: { valorInicial: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [termo, setTermo] = useState(valorInicial);
  const [buscando, iniciarBusca] = useTransition();

  useEffect(() => {
    // Nada a fazer quando o texto é o mesmo que já está na URL — evita uma
    // navegação redundante logo ao abrir a página.
    if (termo === valorInicial) {
      return;
    }

    const temporizador = setTimeout(() => {
      const query = new URLSearchParams(searchParams);

      if (termo) {
        query.set('busca', termo);
      } else {
        query.delete('busca');
      }

      // Volta para a primeira página: o resultado da nova busca provavelmente
      // não tem a mesma quantidade de páginas da anterior.
      query.delete('pagina');

      iniciarBusca(() => {
        router.replace(`/painel/clientes?${query.toString()}`);
      });
    }, 400);

    return () => clearTimeout(temporizador);
  }, [termo, valorInicial, router, searchParams]);

  return (
    <div className="flex items-center gap-3">
      <input
        type="search"
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
        placeholder="Buscar por nome, e-mail ou telefone"
        aria-label="Buscar clientes"
        className="focus-visible:ring-ring focus-visible:border-ring h-10 w-full max-w-sm rounded-md border bg-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      />

      {/* `aria-live` faz o leitor de tela anunciar a busca em andamento, que de
          outra forma seria uma mudança silenciosa. */}
      <span aria-live="polite" className="text-muted-foreground text-xs">
        {buscando ? 'Buscando…' : ''}
      </span>
    </div>
  );
}
