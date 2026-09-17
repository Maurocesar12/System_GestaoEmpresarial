'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  agendamentoFormSchema,
  formatarBRL,
  type Agendamento,
  type AgendamentoFormEntrada,
  type AgendamentoFormInput,
  type Cliente,
  type Orcamento,
  type PessoaEquipe,
  type Servico,
} from '@gestao/shared-types';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { paraCampoDatetimeLocal, proximaHoraCheia } from '@/lib/formatacao';
import type { ResultadoAcao } from '@/lib/acoes';
import { salvarAgendamento } from './acoes';

const CAMPOS = [
  'clienteId',
  'servicoId',
  'dataHora',
  'observacoes',
  'tecnicoId',
  'orcamentoId',
] as const;

const ESTILO_SELECT =
  'focus-visible:ring-ring focus-visible:border-ring h-10 rounded-md border bg-transparent px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';

export function FormularioAgendamento({
  agendamento,
  clientes,
  servicos,
  pessoas,
  orcamentos,
  clienteFixo,
}: {
  agendamento?: Agendamento;
  clientes: Cliente[];
  servicos: Servico[];
  pessoas: PessoaEquipe[];
  /** Orçamentos aprovados; a lista mostra só os do cliente escolhido. */
  orcamentos: Orcamento[];
  clienteFixo?: string;
}) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<AgendamentoFormEntrada, unknown, AgendamentoFormInput>({
    resolver: zodResolver(agendamentoFormSchema),
    defaultValues: {
      clienteId: agendamento?.clienteId ?? clienteFixo ?? '',
      servicoId: agendamento?.servicoId ?? '',
      // O `<input type="datetime-local">` espera "AAAA-MM-DDTHH:mm" sem fuso.
      // Cortar o ISO em 16 caracteres entrega exatamente esse formato.
      dataHora: agendamento ? paraCampoDatetimeLocal(agendamento.dataHora) : proximaHoraCheia(),
      observacoes: agendamento?.observacoes ?? '',
      tecnicoId: agendamento?.tecnicoId ?? '',
      orcamentoId: agendamento?.orcamentoId ?? '',
    },
  });

  const clienteEscolhido = useWatch({ control, name: 'clienteId' });
  const orcamentosDoCliente = orcamentos.filter(
    (orcamento) => orcamento.clienteId === clienteEscolhido,
  );

  const aoEnviar = (dados: AgendamentoFormInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarAgendamento(agendamento?.id ?? null, dados);

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
          {...register('servicoId')}
        >
          <option value="">Sem serviço do catálogo</option>
          {servicos.map((servico) => (
            <option key={servico.id} value={servico.id}>
              {servico.nome}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Ao marcar como executado, este serviço vira o registro no histórico do cliente.
        </p>
      </div>

      <Campo
        rotulo="Data e hora"
        type="datetime-local"
        erro={errors.dataHora?.message}
        {...register('dataHora')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tecnicoId" className="text-sm font-medium">
            Técnico
          </label>
          <select id="tecnicoId" className={ESTILO_SELECT} {...register('tecnicoId')}>
            <option value="">Sem técnico definido</option>
            {pessoas.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">Recebe a comissão de execução.</p>
          {errors.tecnicoId && (
            <p className="text-destructive text-xs">{errors.tecnicoId.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="orcamentoId" className="text-sm font-medium">
            Orçamento
          </label>
          <select id="orcamentoId" className={ESTILO_SELECT} {...register('orcamentoId')}>
            <option value="">Sem orçamento</option>
            {orcamentosDoCliente.map((orcamento) => (
              <option key={orcamento.id} value={orcamento.id}>
                {orcamento.servicoNome ?? 'Sem serviço'} — {formatarBRL(orcamento.valor)}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Valor base da comissão. Sem orçamento, vale o preço padrão do serviço.
          </p>
          {errors.orcamentoId && (
            <p className="text-destructive text-xs">{errors.orcamentoId.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="observacoes" className="text-sm font-medium">
          Observações
        </label>
        <textarea
          id="observacoes"
          rows={3}
          placeholder="Endereço, o que levar, o que combinar."
          className="focus-visible:ring-ring focus-visible:border-ring rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          {...register('observacoes')}
        />
      </div>

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {agendamento ? 'Salvar alterações' : 'Agendar'}
        </Botao>

        <Link
          href="/painel/agenda"
          className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
