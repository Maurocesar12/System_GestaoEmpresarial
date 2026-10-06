'use client';

import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { verificarDoisFatores } from '../../acoes';
import { CampoCodigo } from '../campo-codigo';

/**
 * Segunda etapa do login: os 6 números do app autenticador.
 *
 * Sem códigos de recuperação: quem perdeu o celular é orientado a pedir ao
 * administrador da empresa, que redefine o 2FA pela tela Equipe.
 */
export function FormularioVerificacao() {
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-5">
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

        <CampoCodigo ajuda="O número muda a cada 30 segundos. Se mudar enquanto você digita, use o novo." />

        <Botao type="submit" carregando={enviando}>
          Entrar
        </Botao>
      </form>

      <div className="bg-muted/40 flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Smartphone aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">Perdeu ou trocou de celular?</span> Peça ao
          administrador da sua empresa para redefinir a sua verificação em duas etapas. No próximo
          login, você configura o app de novo.
        </p>
      </div>

      <Link
        href="/entrar"
        className="text-muted-foreground text-center text-sm underline underline-offset-4"
      >
        Entrar com outra conta
      </Link>
    </div>
  );
}
