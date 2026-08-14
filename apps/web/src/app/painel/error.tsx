'use client';

import { useEffect } from 'react';

/**
 * Tela de falha da área autenticada.
 *
 * O Next mostra este componente quando a renderização de qualquer página do
 * painel lança — o caso mais comum sendo a API fora do ar.
 *
 * Sem ele, o usuário recebe uma página de erro genérica (ou, em
 * desenvolvimento, um stack trace). Nenhum dos dois diz o que fazer, e em
 * produção o stack trace ainda exporia a estrutura interna do sistema.
 *
 * A distinção entre desenvolvimento e produção aqui é proposital: quem está
 * desenvolvendo precisa da mensagem técnica para agir; quem está usando o
 * sistema precisa saber que o problema não é culpa dele e que tentar de novo
 * costuma resolver.
 */
export default function ErroPainel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção isto vai para o console do navegador do usuário — de onde o
    // suporte consegue extrair o `digest` e cruzar com o log do servidor.
    console.error('Falha ao carregar o painel:', error);
  }, [error]);

  const emDesenvolvimento = process.env.NODE_ENV !== 'production';
  const pareceApiFora = error.message.includes('Não foi possível falar com a API');

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">
          {pareceApiFora ? 'O servidor não respondeu' : 'Algo deu errado'}
        </h1>

        <p className="text-muted-foreground max-w-md text-sm">
          {pareceApiFora
            ? 'Não conseguimos carregar seus dados agora. Isso costuma ser temporário — tente de novo em alguns instantes.'
            : 'Não foi possível carregar esta tela. Tente de novo; se continuar, avise o suporte.'}
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Tentar novamente
      </button>

      {emDesenvolvimento && (
        <details className="mt-2 max-w-lg text-left">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            Detalhes técnicos
          </summary>
          <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {error.message}
          </pre>
          <p className="text-muted-foreground mt-2 text-xs">
            Se a API não estiver rodando, suba os dois serviços com{' '}
            <code className="font-mono">pnpm dev</code> na raiz do projeto.
          </p>
        </details>
      )}

      {/* O digest correlaciona esta falha com a entrada no log do servidor. */}
      {!emDesenvolvimento && error.digest && (
        <p className="text-muted-foreground font-mono text-xs">código: {error.digest}</p>
      )}
    </div>
  );
}
