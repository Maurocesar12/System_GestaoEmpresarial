'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { aceitarConviteSchema, type AceitarConviteInput } from '@gestao/shared-types';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { aceitarConvite } from './acoes';

type CamposConvite = Omit<AceitarConviteInput, 'token'>;

export function FormularioAceitarConvite() {
  const [token, setToken] = useState<string>();
  const [pronto, setPronto] = useState(false);
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CamposConvite>({
    resolver: zodResolver(aceitarConviteSchema.omit({ token: true })),
    defaultValues: { nome: '', senha: '' },
  });

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.hash.slice(1));
    const legado = new URLSearchParams(window.location.search);
    const recebido = parametros.get('token') ?? legado.get('token') ?? undefined;
    setToken(recebido);
    if (recebido && (window.location.hash || legado.has('token'))) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setPronto(true);
  }, []);

  if (pronto && !token) {
    return (
      <p className="text-destructive text-sm">
        O link do convite está incompleto. Peça ao administrador para enviar um novo convite.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((dados) =>
        iniciar(async () => {
          if (!token) return;
          const resultado = await aceitarConvite({ ...dados, token });
          setFalha(resultado.erro);
        }),
      )}
      noValidate
    >
      {falha && <AvisoErro mensagem={falha} />}
      <Campo rotulo="Seu nome" erro={errors.nome?.message} {...register('nome')} />
      <Campo
        rotulo="Crie uma senha"
        type="password"
        ajuda="Use pelo menos 10 caracteres."
        erro={errors.senha?.message}
        {...register('senha')}
      />
      <Botao type="submit" carregando={enviando} disabled={!pronto || !token}>
        Entrar para a equipe
      </Botao>
    </form>
  );
}
