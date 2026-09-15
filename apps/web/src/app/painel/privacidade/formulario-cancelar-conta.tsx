'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { cancelamentoContaSchema, type CancelamentoContaInput } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import type { ResultadoAcao } from '@/lib/acoes';
import { cancelarConta } from './acoes';

const CAMPOS = ['nomeEmpresa', 'senha'] as const;

/**
 * Pede o nome da empresa e a senha: são duas confirmações que um clique
 * acidental, ou alguém num computador destravado, não consegue dar.
 */
export function FormularioCancelarConta({ nomeEmpresa }: { nomeEmpresa: string }) {
  const [ciente, setCiente] = useState(false);
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CancelamentoContaInput>({
    resolver: zodResolver(cancelamentoContaSchema),
    defaultValues: { nomeEmpresa: '', senha: '' },
  });

  const aoEnviar = (dados: CancelamentoContaInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await cancelarConta(dados);

      // Em caso de sucesso a action redireciona e nada aqui executa.
      for (const [campo, mensagens] of Object.entries(resultado?.campos ?? {})) {
        if ((CAMPOS as readonly string[]).includes(campo)) {
          setError(campo as (typeof CAMPOS)[number], { message: mensagens[0] });
        }
      }

      setFalha(resultado);
    });
  };

  return (
    <form
      method="post"
      onSubmit={handleSubmit(aoEnviar)}
      className="flex max-w-sm flex-col gap-4"
      noValidate
    >
      {falha?.erro && !falha.campos && <AvisoErro mensagem={falha.erro} />}

      <Campo
        rotulo={`Digite o nome da empresa: ${nomeEmpresa}`}
        autoComplete="off"
        erro={errors.nomeEmpresa?.message}
        {...register('nomeEmpresa')}
      />

      <Campo
        rotulo="Sua senha"
        type="password"
        autoComplete="current-password"
        erro={errors.senha?.message}
        {...register('senha')}
      />

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={ciente}
          onChange={(evento) => setCiente(evento.target.checked)}
          className="mt-0.5"
        />
        <span>Entendo que os dados serão excluídos e que isso não pode ser desfeito.</span>
      </label>

      <Botao
        type="submit"
        variante="perigo"
        carregando={enviando}
        disabled={!ciente}
        className="w-fit"
      >
        Cancelar conta
      </Botao>
    </form>
  );
}
