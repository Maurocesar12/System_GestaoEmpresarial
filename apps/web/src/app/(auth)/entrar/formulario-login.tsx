'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import type { ResultadoAcao } from '@/lib/acoes';
import { entrar } from '../acoes';

/**
 * Formulário de login.
 *
 * A validação usa `loginSchema`, o **mesmo** schema que a API aplica no
 * servidor. Não há como o formulário aceitar algo que a API recusa, nem o
 * contrário — a regra existe em um lugar só, em `@gestao/shared-types`.
 *
 * A validação no cliente serve para dar resposta imediata a quem digita. A que
 * protege o sistema é a do servidor, que roda de qualquer forma.
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
    resolver: zodResolver(loginSchema),
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
    </form>
  );
}
