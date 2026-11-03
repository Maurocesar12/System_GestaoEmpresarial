'use client';

import { useRef } from 'react';

/**
 * Chave de idempotência de um formulário (cabeçalho `Idempotency-Key` da API).
 *
 * Nasce na tela, e não na server action, de propósito: a action roda uma vez por
 * envio, então uma chave gerada lá nunca se repetiria num duplo clique ou num
 * reenvio depois de a conexão cair. Aqui, os dois envios levam a mesma chave e a
 * API executa uma vez só.
 *
 * - `chave()`: a chave do envio em curso (a mesma até ser renovada).
 * - `renovar()`: chame quando o envio **deu certo**. A chave guarda a resposta
 *   daquele pedido; reaproveitá-la num pedido novo seria recusado. Depois de uma
 *   falha não renove — a API libera a chave de quem falhou, e tentar de novo é
 *   justamente o caso que ela cobre.
 */
export function useChaveIdempotencia() {
  const atual = useRef<string | null>(null);

  return {
    chave: (): string => (atual.current ??= crypto.randomUUID()),
    renovar: (): void => {
      atual.current = null;
    },
  };
}
