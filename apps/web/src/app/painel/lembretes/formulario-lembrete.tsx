'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CANAIS_LEMBRETE,
  ROTULO_CANAL_LEMBRETE,
  lembreteFormSchema,
  type Cliente,
  type LembreteFormEntrada,
  type LembreteFormInput,
} from '@gestao/shared-types';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { proximaHoraCheia } from '@/lib/formatacao';
import type { ResultadoAcao } from '@/lib/acoes';
import { salvarLembrete } from './acoes';

const CAMPOS = ['clienteId', 'canal', 'dataEnvio'] as const;

export function FormularioLembrete({
  clientes,
  clienteFixo,
}: {
  clientes: Cliente[];
  clienteFixo?: string;
}) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LembreteFormEntrada, unknown, LembreteFormInput>({
    resolver: zodResolver(lembreteFormSchema),
    defaultValues: {
      clienteId: clienteFixo ?? '',
      canal: 'email',
      dataEnvio: proximaHoraCheia(),
    },
  });

  const aoEnviar = (dados: LembreteFormInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarLembrete(dados);

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
    <form
      method="post"
      onSubmit={handleSubmit(aoEnviar)}
      className="flex max-w-xl flex-col gap-4"
      noValidate
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} detalhes={falha.campos} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="clienteId" className="text-sm font-medium">
          Cliente
        </label>
        <select
          id="clienteId"
          className="focus-visible:ring-ring focus-visible:border-ring h-10 rounded-md border bg-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          {...register('clienteId')}
        >
          <option value="">Selecione…</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </select>
        {errors.clienteId && <p className="text-destructive text-xs">{errors.clienteId.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="canal" className="text-sm font-medium">
            Canal
          </label>
          <select
            id="canal"
            className="focus-visible:ring-ring focus-visible:border-ring h-10 rounded-md border bg-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            {...register('canal')}
          >
            {CANAIS_LEMBRETE.map((canal) => (
              <option key={canal} value={canal}>
                {ROTULO_CANAL_LEMBRETE[canal]}
              </option>
            ))}
          </select>
          {errors.canal && <p className="text-destructive text-xs">{errors.canal.message}</p>}
        </div>

        <Campo
          rotulo="Quando lembrar"
          type="datetime-local"
          erro={errors.dataEnvio?.message}
          {...register('dataEnvio')}
        />
      </div>

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          Criar lembrete
        </Botao>

        <Link
          href="/painel/lembretes"
          className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
