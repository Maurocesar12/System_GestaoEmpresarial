'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Campo } from '@/components/ui/campo';
import { Botao } from '@/components/ui/botao';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { recuperarSenha } from './acoes';

export function FormularioRecuperacao() {
  const [token, setToken] = useState<string>();
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string>();
  const [sucesso, setSucesso] = useState(false);
  const [enviando, iniciar] = useTransition();
  useEffect(() => {
    const recebido = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (recebido) {
      setToken(recebido);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setPronto(true);
  }, []);

  return <div className="flex flex-col gap-5">
    <h1 className="text-2xl font-semibold">{token ? 'Definir nova senha' : 'Recuperar senha'}</h1>
    {sucesso ? <p role="status" className="text-sm leading-relaxed">{token
      ? 'Senha alterada. Entre com sua nova senha.'
      : 'Se houver uma conta ativa com esse e-mail, você receberá um link de recuperação. Confira também a pasta de spam.'}</p>
      : <form method="post" className="flex flex-col gap-4" onSubmit={(evento) => {
        evento.preventDefault();
        const campos = new FormData(evento.currentTarget);
        const senha = String(campos.get('senha') ?? '');
        if (token && senha !== campos.get('confirmacao')) { setErro('As senhas não coincidem.'); return; }
        setErro(undefined);
        iniciar(async () => {
          const resposta = await recuperarSenha(token ? { token, senha } : { email: String(campos.get('email')) });
          setErro(resposta.erro);
          setSucesso(!resposta.erro);
        });
      }}>
        {erro && <AvisoErro mensagem={erro} />}
        {token ? <>
          <Campo name="senha" rotulo="Nova senha" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
          <Campo name="confirmacao" rotulo="Confirmar nova senha" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
        </> : <Campo name="email" rotulo="E-mail da conta" type="email" autoComplete="email" required />}
        <Botao type="submit" carregando={enviando} disabled={!pronto}>{token ? 'Salvar nova senha' : 'Enviar link de recuperação'}</Botao>
      </form>}
    <Link href="/entrar" className="text-sm underline underline-offset-4">Voltar para entrar</Link>
  </div>;
}
