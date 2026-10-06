'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { verificarDoisFatores } from '../../acoes';

/**
 * Segunda etapa do login: o código do app ou, sem o celular, um de recuperação.
 *
 * Os dois vão para o mesmo campo e a API distingue pelo formato. A troca de
 * modo só muda o teclado e o texto de ajuda — no celular, o teclado numérico
 * para os 6 dígitos poupa um toque a cada login.
 */
export function FormularioVerificacao() {
  const [recuperacao, setRecuperacao] = useState(false);
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();

  return (
    <form
      method="post"
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        setFalha(undefined);
        const codigo = String(new FormData(evento.currentTarget).get('codigo') ?? '');
        iniciar(async () => {
          // Sucesso redireciona; chegar aqui é erro.
          const resultado = await verificarDoisFatores(codigo);
          setFalha(resultado?.erro);
        });
      }}
    >
      {falha && <AvisoErro mensagem={falha} />}

      <Campo
        // A chave recria o campo ao trocar de modo, limpando o que foi digitado.
        key={recuperacao ? 'recuperacao' : 'app'}
        name="codigo"
        rotulo={recuperacao ? 'Código de recuperação' : 'Código do app'}
        placeholder={recuperacao ? 'xxxx-xxxx' : '000000'}
        inputMode={recuperacao ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoFocus
        maxLength={recuperacao ? 20 : 6}
        ajuda={
          recuperacao
            ? 'Um dos códigos que você guardou ao configurar. Cada um vale uma vez.'
            : 'O código muda a cada 30 segundos.'
        }
        className={recuperacao ? undefined : 'text-center font-mono text-lg tracking-[0.4em]'}
      />

      <Botao type="submit" carregando={enviando}>
        Confirmar
      </Botao>

      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setRecuperacao((atual) => !atual);
            setFalha(undefined);
          }}
          className="underline underline-offset-4"
        >
          {recuperacao ? 'Usar o código do app' : 'Estou sem o celular'}
        </button>
        <Link href="/entrar" className="text-muted-foreground underline underline-offset-4">
          Entrar com outra conta
        </Link>
      </div>
    </form>
  );
}
