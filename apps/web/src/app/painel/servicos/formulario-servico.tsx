'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  margemPercentual,
  servicoFormSchema,
  type Servico,
  type ServicoFormEntrada,
  type ServicoFormInput,
} from '@gestao/shared-types';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { salvarServico, type ResultadoAcao } from './acoes';

const CAMPOS = ['nome', 'categoria', 'custoBase', 'precoPadrao'] as const;

/**
 * Formulário de serviço.
 *
 * A margem é calculada enquanto a pessoa digita. Ver o percentual mudar em
 * tempo real é o que transforma "custo base" de campo burocrático em decisão
 * de preço — sem isso, o número seria preenchido no chute e nunca revisto.
 */
export function FormularioServico({ servico }: { servico?: Servico }) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ServicoFormEntrada, unknown, ServicoFormInput>({
    resolver: zodResolver(servicoFormSchema),
    defaultValues: {
      nome: servico?.nome ?? '',
      categoria: servico?.categoria ?? '',
      // Vem do banco como "250.00" e é exibido como "250,00".
      custoBase: servico?.custoBase.replace('.', ',') ?? '',
      precoPadrao: servico?.precoPadrao?.replace('.', ',') ?? '',
      ativo: servico?.ativo ?? true,
    },
  });

  // `useWatch` acompanha os dois campos sem re-renderizar o formulário inteiro
  // a cada tecla.
  const custo = useWatch({ control, name: 'custoBase' });
  const preco = useWatch({ control, name: 'precoPadrao' });

  const margem = calcularMargemPrevia(custo, preco);

  const aoEnviar = (dados: ServicoFormInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarServico(servico?.id ?? null, dados);

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

      <Campo
        rotulo="Nome do serviço"
        placeholder="Instalação de ar-condicionado"
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <Campo
        rotulo="Categoria"
        ajuda="Opcional. Ajuda a agrupar no relatório de margem."
        placeholder="Instalação"
        erro={errors.categoria?.message}
        {...register('categoria')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Custo para executar"
          inputMode="decimal"
          placeholder="250,00"
          ajuda="Material, deslocamento, mão de obra."
          erro={errors.custoBase?.message}
          {...register('custoBase')}
        />

        <Campo
          rotulo="Preço sugerido"
          inputMode="decimal"
          placeholder="600,00"
          ajuda="Opcional. Preenche o orçamento automaticamente."
          erro={errors.precoPadrao?.message}
          {...register('precoPadrao')}
        />
      </div>

      {margem !== null && (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            margem < 0 ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'bg-muted/30'
          }`}
        >
          Margem: <strong className="tabular-nums">{margem.toFixed(1)}%</strong>
          {margem < 0 && ' — o preço está abaixo do custo.'}
        </p>
      )}

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {servico ? 'Salvar alterações' : 'Cadastrar serviço'}
        </Botao>

        <Link
          href="/painel/servicos"
          className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

/**
 * Margem a partir do que está digitado no formulário.
 *
 * Os valores ainda estão no formato brasileiro e podem estar incompletos —
 * alguém no meio de digitar "1.2" não deve ver um erro. Devolve `null` sempre
 * que a conta não faz sentido ainda.
 */
function calcularMargemPrevia(custo?: string, preco?: string | null): number | null {
  if (!custo || !preco) return null;

  const normalizar = (valor: string) => valor.replace(/\./g, '').replace(',', '.');

  const custoNumero = Number(normalizar(custo));
  const precoNumero = Number(normalizar(preco));

  if (!Number.isFinite(custoNumero) || !Number.isFinite(precoNumero)) return null;

  return margemPercentual(custoNumero.toFixed(2), precoNumero.toFixed(2));
}
