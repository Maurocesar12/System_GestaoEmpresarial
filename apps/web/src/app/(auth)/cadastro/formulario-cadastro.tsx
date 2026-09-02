'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { cadastroSchema, type CadastroInput } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import type { ResultadoAcao } from '@/lib/acoes';
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
  const [falha, setFalha] = useState<ResultadoAcao>();
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
    setFalha(undefined);

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

      setFalha(resultado);
    });
  };

  return (
    // `method="post"` protege o caso em que o JavaScript não carrega: o envio
    // nativo do HTML é GET por padrão, e colocaria a senha na URL.
    <form
      method="post"
      onSubmit={handleSubmit(aoEnviar)}
      className="flex flex-col gap-4"
      noValidate
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} detalhes={falha.campos} />}

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
