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
import { useForm, useWatch } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Selecao } from '@/components/ui/selecao';
import type { ResultadoAcao } from '@/lib/acoes';
import { salvarLancamento } from './acoes';

const CAMPOS = [
  'tipo',
  'natureza',
  'descricao',
  'valor',
  'data',
  'vencimento',
  'pagoEm',
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
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LancamentoFormEntrada, unknown, LancamentoFormInput>({
    resolver: zodResolver(lancamentoFormSchema),
    defaultValues: {
      tipo: lancamento?.tipo ?? 'entrada',
      natureza: lancamento?.natureza ?? 'empresa',
      descricao: lancamento?.descricao ?? '',
      valor: lancamento?.valor.replace('.', ',') ?? '',
      data: lancamento?.data ?? hojeISO(),
      vencimento: lancamento?.vencimento ?? '',
      // Lançamento novo nasce **pago**, com a data de hoje: o caso mais comum é
      // registrar algo que acabou de acontecer. Quem está cadastrando uma conta
      // a receber limpa este campo, e o formulário explica o efeito disso.
      pagoEm: lancamento ? (lancamento.pagoEm ?? '') : hojeISO(),
      categoriaId: lancamento?.categoriaId ?? '',
      servicoId: lancamento?.servicoId ?? '',
      clienteId: lancamento?.clienteId ?? '',
    },
  });

  const tipo = useWatch({ control, name: 'tipo' });
  const pagoEm = useWatch({ control, name: 'pagoEm' });

  // Sem data de pagamento o lançamento é uma promessa, não caixa. O formulário
  // avisa disso na hora, em vez de a pessoa estranhar o saldo no fim do mês.
  const emAberto = !pagoEm;

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
        <Selecao rotulo="Tipo" erro={errors.tipo?.message} {...register('tipo')}>
          <option value="entrada">{ROTULO_TIPO_LANCAMENTO.entrada}</option>
          <option value="saida">{ROTULO_TIPO_LANCAMENTO.saida}</option>
        </Selecao>

        <Selecao
          rotulo="Natureza"
          // A separação é o que impede o gasto pessoal de distorcer a margem.
          ajuda="Pessoal fica fora do caixa da empresa e dos relatórios."
          erro={errors.natureza?.message}
          {...register('natureza')}
        >
          <option value="empresa">{ROTULO_NATUREZA.empresa}</option>
          <option value="pessoal">{ROTULO_NATUREZA.pessoal}</option>
        </Selecao>
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

        <Campo
          rotulo="Data"
          type="date"
          ajuda="Quando o serviço foi prestado."
          erro={errors.data?.message}
          {...register('data')}
        />
      </div>

      {/*
        Pagamento em bloco separado: são os dois campos que decidem se isto é
        dinheiro em caixa ou uma conta em aberto — a distinção mais importante
        do formulário, e a que mais confunde quem está aprendendo o sistema.
      */}
      <fieldset className="border-t pt-4">
        <legend className="sr-only">Pagamento</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Vencimento"
            type="date"
            ajuda="Opcional. Quando este valor é devido."
            erro={errors.vencimento?.message}
            {...register('vencimento')}
          />

          <Campo
            rotulo="Pago em"
            type="date"
            ajuda="Deixe vazio se ainda não foi pago."
            erro={errors.pagoEm?.message}
            {...register('pagoEm')}
          />
        </div>

        {emAberto && (
          <p className="bg-atencao-suave text-atencao mt-3 rounded-md px-3 py-2 text-xs">
            Sem data de pagamento, este lançamento fica{' '}
            <strong className="font-semibold">
              {tipo === 'entrada' ? 'a receber' : 'a pagar'}
            </strong>{' '}
            e não entra no fluxo de caixa nem na margem até você dar baixa.
          </p>
        )}
      </fieldset>

      <Selecao
        rotulo="Serviço"
        ajuda={
          tipo === 'entrada'
            ? 'Vincular é o que permite saber quanto este serviço faturou e qual a margem dele.'
            : 'Vincule custos ao serviço que os gerou para a margem sair correta.'
        }
        erro={errors.servicoId?.message}
        {...register('servicoId')}
      >
        <option value="">Não vincular</option>
        {servicos.map((servico) => (
          <option key={servico.id} value={servico.id}>
            {servico.nome}
          </option>
        ))}
      </Selecao>

      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao rotulo="Categoria" erro={errors.categoriaId?.message} {...register('categoriaId')}>
          <option value="">Sem categoria</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </Selecao>

        <Selecao rotulo="Cliente" erro={errors.clienteId?.message} {...register('clienteId')}>
          <option value="">Não vincular</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </Selecao>
      </div>

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {lancamento ? 'Salvar alterações' : 'Lançar'}
        </Botao>

        <Link href="/painel/financeiro" className={estilosBotao({ variante: 'secundario' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
