'use client';

import { type LoginInput } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import type { ResultadoAcao } from '@/lib/acoes';
import { entrar } from '../acoes';
import Link from 'next/link';

/**
 * Formulário de login.
 *
 * Não valida nada na tela: quem valida é a API, e os erros por campo voltam da
 * ação e são marcados aqui. Assim a regra existe num lugar só — e a tela não
 * carrega a biblioteca de validação.
 */
export function FormularioLogin() {
  const [falha, setFalha] = useState<ResultadoAcao>();

  // `useTransition` mantém a interface responsiva enquanto a Server Action
  // roda, e dá o estado de "em andamento" sem precisar controlá-lo à mão.
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    defaultValues: { email: '', senha: '' },
  });

  const aoEnviar = (dados: LoginInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await entrar(dados);

      // Em caso de sucesso a action redireciona e nada aqui executa. Chegar a
      // esta linha significa que houve erro.
      if (resultado?.campos) {
        for (const [campo, mensagens] of Object.entries(resultado.campos)) {
          if (campo === 'email' || campo === 'senha') {
            setError(campo, { message: mensagens[0] });
          }
        }
      }

      setFalha(resultado);
    });
  };

  return (
    // `method="post"` não é decoração: se o JavaScript falhar em carregar, o
    // navegador faz o envio nativo do formulário, e o padrão do HTML é **GET**
    // — o que colocaria a senha na barra de endereços, no histórico e nos logs
    // do servidor. Com `post`, o pior caso vira uma página de erro, e não uma
    // credencial vazada.
    <form
      method="post"
      onSubmit={handleSubmit(aoEnviar)}
      className="flex flex-col gap-4"
      noValidate
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} detalhes={falha.campos} />}

      <Campo
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com.br"
        erro={errors.email?.message}
        {...register('email')}
      />

      <Campo
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        erro={errors.senha?.message}
        {...register('senha')}
      />

      <Botao type="submit" carregando={enviando}>
        Entrar
      </Botao>
      <Link href="/recuperar-senha" className="text-center text-sm underline underline-offset-4">
        Esqueci minha senha
      </Link>
    </form>
  );
}
