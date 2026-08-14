'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ROTULO_NATUREZA,
  ROTULO_TIPO_LANCAMENTO,
  hojeISO,
  lancamentoFormSchema,
  type CategoriaFinanceira,
  type Cliente,
  type Lancamento,
  type LancamentoFormEntrada,
  type LancamentoFormInput,
  type Servico,
} from '@gestao/shared-types';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { salvarLancamento, type ResultadoAcao } from './acoes';

const CAMPOS = [
  'tipo',
  'natureza',
  'descricao',
  'valor',
  'data',
  'categoriaId',
  'servicoId',
  'clienteId',
] as const;

/**
 * Formulário de lançamento.
 *
 * O campo de serviço tem destaque e explicação: é ele que torna a margem
 * calculável. Um lançamento sem serviço entra no caixa mas não aparece em
 * nenhuma margem, e quem preenche precisa saber disso na hora — não ao
 * estranhar o relatório no fim do mês.
 */
export function FormularioLancamento({
  lancamento,
  categorias,
  servicos,
  clientes,
}: {
  lancamento?: Lancamento;
  categorias: CategoriaFinanceira[];
  servicos: Servico[];
  clientes: Cliente[];
}) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<LancamentoFormEntrada, unknown, LancamentoFormInput>({
    resolver: zodResolver(lancamentoFormSchema),
    defaultValues: {
      tipo: lancamento?.tipo ?? 'entrada',
      natureza: lancamento?.natureza ?? 'empresa',
      descricao: lancamento?.descricao ?? '',
      valor: lancamento?.valor.replace('.', ',') ?? '',
      data: lancamento?.data ?? hojeISO(),
      categoriaId: lancamento?.categoriaId ?? '',
      servicoId: lancamento?.servicoId ?? '',
      clienteId: lancamento?.clienteId ?? '',
    },
  });

  const tipo = watch('tipo');

  const aoEnviar = (dados: LancamentoFormInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarLancamento(lancamento?.id ?? null, dados);

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="tipo"
            className="focus-visible:ring-ring h-10 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            {...register('tipo')}
          >
            <option value="entrada">{ROTULO_TIPO_LANCAMENTO.entrada}</option>
            <option value="saida">{ROTULO_TIPO_LANCAMENTO.saida}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="natureza" className="text-sm font-medium">
            Natureza
          </label>
          <select
            id="natureza"
            className="focus-visible:ring-ring h-10 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            {...register('natureza')}
          >
            <option value="empresa">{ROTULO_NATUREZA.empresa}</option>
            <option value="pessoal">{ROTULO_NATUREZA.pessoal}</option>
          </select>
          {/* A separação é o que impede o gasto pessoal de distorcer a margem. */}
          <p className="text-muted-foreground text-xs">
            Pessoal fica fora do caixa da empresa e dos relatórios.
          </p>
        </div>
      </div>

      <Campo
        rotulo="Descrição"
        placeholder={tipo === 'entrada' ? 'Serviço prestado a…' : 'Compra de material'}
        erro={errors.descricao?.message}
        {...register('descricao')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Valor"
          inputMode="decimal"
          placeholder="1.500,00"
          erro={errors.valor?.message}
          {...register('valor')}
        />

        <Campo rotulo="Data" type="date" erro={errors.data?.message} {...register('data')} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="servicoId" className="text-sm font-medium">
          Serviço
        </label>
        <select
          id="servicoId"
          className="focus-visible:ring-ring h-10 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          {...register('servicoId')}
        >
          <option value="">Não vincular</option>
          {servicos.map((servico) => (
            <option key={servico.id} value={servico.id}>
              {servico.nome}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          {tipo === 'entrada'
            ? 'Vincular é o que permite saber quanto este serviço faturou e qual a margem dele.'
            : 'Vincule custos ao serviço que os gerou para a margem sair correta.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoriaId" className="text-sm font-medium">
            Categoria
          </label>
          <select
            id="categoriaId"
            className="focus-visible:ring-ring h-10 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            {...register('categoriaId')}
          >
            <option value="">Sem categoria</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="clienteId" className="text-sm font-medium">
            Cliente
          </label>
          <select
            id="clienteId"
            className="focus-visible:ring-ring h-10 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            {...register('clienteId')}
          >
            <option value="">Não vincular</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {lancamento ? 'Salvar alterações' : 'Lançar'}
        </Botao>

        <Link
          href="/painel/financeiro"
          className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
