'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { aceitarConviteSchema, type AceitarConviteInput } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { aceitarConvite } from './acoes';

export function FormularioAceitarConvite({ token }: { token: string }) {
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AceitarConviteInput>({
    resolver: zodResolver(aceitarConviteSchema),
    defaultValues: { token, nome: '', senha: '' },
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((dados) =>
        iniciar(async () => {
          const resultado = await aceitarConvite(dados);
          setFalha(resultado.erro);
        }),
      )}
      noValidate
    >
      {falha && <AvisoErro mensagem={falha} />}
      <input type="hidden" {...register('token')} />
      <Campo rotulo="Seu nome" erro={errors.nome?.message} {...register('nome')} />
      <Campo
        rotulo="Crie uma senha"
        type="password"
        ajuda="Use pelo menos 10 caracteres."
        erro={errors.senha?.message}
        {...register('senha')}
      />
      <Botao type="submit" carregando={enviando}>
        Entrar para a equipe
      </Botao>
    </form>
  );
}
