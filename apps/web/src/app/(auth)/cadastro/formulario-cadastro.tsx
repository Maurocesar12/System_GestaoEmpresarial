'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { cadastroSchema, type CadastroInput } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { cadastrar } from '../acoes';

/** Campos do formulário, para o `setError` saber quais existem. */
const CAMPOS = ['nomeEmpresa', 'nomeResponsavel', 'email', 'senha'] as const;

/**
 * Formulário de cadastro de empresa.
 *
 * Valida com `cadastroSchema`, o mesmo schema que a API usa — inclusive a regra
 * de senha. Assim a mensagem "a senha precisa de pelo menos 10 caracteres"
 * aparece enquanto a pessoa digita, e não depois de enviar.
 */
export function FormularioCadastro() {
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CadastroInput>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { nomeEmpresa: '', nomeResponsavel: '', email: '', senha: '' },
  });

  const aoEnviar = (dados: CadastroInput) => {
    setErroGeral(undefined);

    iniciarEnvio(async () => {
      const resultado = await cadastrar(dados);

      // Em caso de sucesso a action redireciona e nada aqui executa.
      if (resultado?.campos) {
        for (const [campo, mensagens] of Object.entries(resultado.campos)) {
          if ((CAMPOS as readonly string[]).includes(campo)) {
            setError(campo as (typeof CAMPOS)[number], { message: mensagens[0] });
          }
        }
      }

      setErroGeral(resultado?.erro);
    });
  };

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-4" noValidate>
      {erroGeral && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {erroGeral}
        </p>
      )}

      <Campo
        rotulo="Nome da empresa"
        autoComplete="organization"
        placeholder="Oficina do João"
        erro={errors.nomeEmpresa?.message}
        {...register('nomeEmpresa')}
      />

      <Campo
        rotulo="Seu nome"
        autoComplete="name"
        placeholder="João da Silva"
        erro={errors.nomeResponsavel?.message}
        {...register('nomeResponsavel')}
      />

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
        autoComplete="new-password"
        ajuda="Pelo menos 10 caracteres."
        erro={errors.senha?.message}
        {...register('senha')}
      />

      <Botao type="submit" carregando={enviando}>
        Criar conta
      </Botao>
    </form>
  );
}
