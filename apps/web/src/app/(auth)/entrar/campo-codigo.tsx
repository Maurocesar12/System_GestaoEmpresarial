'use client';

import { Campo } from '@/components/ui/campo';

/**
 * Campo dos 6 números do app autenticador, usado na ativação e no login.
 *
 * Teclado numérico no celular, preenchimento automático do código quando o
 * sistema oferece, e qualquer coisa que não seja dígito some enquanto a pessoa
 * digita ou cola — "123 456" vira "123456" sem erro nenhum.
 */
export function CampoCodigo({
  desabilitado = false,
  ajuda,
}: {
  desabilitado?: boolean;
  ajuda?: string;
}) {
  return (
    <Campo
      name="codigo"
      rotulo="Código de 6 números"
      placeholder="000000"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      disabled={desabilitado}
      ajuda={ajuda}
      onInput={(evento) => {
        const campo = evento.currentTarget;
        campo.value = campo.value.replace(/\D/g, '').slice(0, 6);
      }}
      className="text-center font-mono text-lg tracking-[0.4em]"
    />
  );
}
