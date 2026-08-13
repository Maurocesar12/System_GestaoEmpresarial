'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatarBRL,
  orcamentoFormSchema,
  type Cliente,
  type Orcamento,
  type OrcamentoFormEntrada,
  type OrcamentoFormInput,
  type Servico,
} from '@gestao/shared-types';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { salvarOrcamento, type ResultadoAcao } from './acoes';

const CAMPOS = ['clienteId', 'servicoId', 'descricao', 'valor', 'validoAte'] as const;

/**
 * Formulário de orçamento.
 *
 * Escolher um serviço do catálogo preenche o valor com o preço padrão dele —
 * mas o campo continua editável. O catálogo é ponto de partida, não tabela
 * fixa: cada negociação tem suas condições.
 */
export function FormularioOrcamento({
  orcamento,
  clientes,
  servicos,
  clienteFixo,
}: {
  orcamento?: Orcamento;
  clientes: Cliente[];
  servicos: Servico[];
  /** Quando vem da ficha de um cliente, o campo já vem preenchido e travado. */
  clienteFixo?: string;
}) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<OrcamentoFormEntrada, unknown, OrcamentoFormInput>({
    resolver: zodResolver(orcamentoFormSchema),
    defaultValues: {
      clienteId: orcamento?.clienteId ?? clienteFixo ?? '',
      servicoId: orcamento?.servicoId ?? '',
      descricao: orcamento?.descricao ?? '',
      // O valor vem do banco como "1500.00" e é exibido como "1500,00" —
      // o mesmo formato que a pessoa vai digitar.
      valor: orcamento?.valor.replace('.', ',') ?? '',
      validoAte: orcamento?.validoAte ?? '',
    },
  });

  const aoEscolherServico = (servicoId: string) => {
    const servico = servicos.find((s) => s.id === servicoId);

    if (servico?.precoPadrao) {
      setValue('valor', servico.precoPadrao.replace('.', ','));
    }
  };

  const aoEnviar = (dados: OrcamentoFormInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarOrcamento(orcamento?.id ?? null, dados);

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
          disabled={Boolean(clienteFixo)}
          className="focus-visible:ring-ring focus-visible:border-ring h-10 rounded-md border bg-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="servicoId" className="text-sm font-medium">
          Serviço
        </label>
        <select
          id="servicoId"
          className="focus-visible:ring-ring focus-visible:border-ring h-10 rounded-md border bg-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          {...register('servicoId', {
            onChange: (evento: React.ChangeEvent<HTMLSelectElement>) =>
              aoEscolherServico(evento.target.value),
          })}
        >
          <option value="">Sem serviço do catálogo</option>
          {servicos.map((servico) => (
            <option key={servico.id} value={servico.id}>
              {servico.nome}
              {servico.precoPadrao ? ` — ${formatarBRL(servico.precoPadrao)}` : ''}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Escolher um serviço preenche o valor com o preço padrão, que você pode ajustar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Valor"
          inputMode="decimal"
          placeholder="1.500,00"
          erro={errors.valor?.message}
          {...register('valor')}
        />

        <Campo
          rotulo="Válido até"
          type="date"
          ajuda="Opcional."
          erro={errors.validoAte?.message}
          {...register('validoAte')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descricao" className="text-sm font-medium">
          Descrição
        </label>
        <textarea
          id="descricao"
          rows={4}
          placeholder="O que está incluído, prazos, condições."
          className="focus-visible:ring-ring focus-visible:border-ring rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          {...register('descricao')}
        />
      </div>

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {orcamento ? 'Salvar alterações' : 'Emitir orçamento'}
        </Botao>

        <Link
          href="/painel/orcamentos"
          className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
