'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiRequestError } from '@/lib/api';

/**
 * Providers globais da aplicação.
 *
 * O QueryClient é criado dentro de `useState` de propósito: instanciá-lo no
 * escopo do módulo faria todos os usuários de uma mesma instância do servidor
 * compartilharem o cache — dado de um tenant aparecendo para outro.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (tentativas, erro) => {
              // Erro de permissão ou validação não melhora com retry.
              if (erro instanceof ApiRequestError && erro.status >= 400 && erro.status < 500) {
                return false;
              }
              return tentativas < 2;
            },
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
