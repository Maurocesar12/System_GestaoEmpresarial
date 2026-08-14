'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  atendimentoFormSchema,
  hojeISO,
  type Atendimento,
  type AtendimentoFormInput,
} from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { registrarAtendimento, removerAtendimento } from './acoes-atendimento';

/**
 * Histórico de atendimentos do cliente.
 *
 * O formulário fica **acima** da lista, e não escondido atrás de um botão:
 * registrar o que acabou de acontecer é a ação mais frequente desta tela, e
 * cada clique a mais entre a pessoa e o registro é uma chance de ela não
 * registrar — e o histórico voltar para o caderno.
 */
export function Atendimentos({
  clienteId,
  atendimentos,
}: {
  clienteId: string;
  atendimentos: Atendimento[];
}) {
  const [erro, setErro] = useState<string>();
  const [salvando, iniciarSalvamento] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AtendimentoFormInput>({
    resolver: zodResolver(atendimentoFormSchema),
    defaultValues: { descricao: '', data: hojeISO() },
  });

  const aoEnviar = (dados: AtendimentoFormInput) => {
    setErro(undefined);

    iniciarSalvamento(async () => {
      const resultado = await registrarAtendimento(clienteId, dados);

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      // Limpa a descrição mas mantém a data: quem registra vários atendimentos
      // de uma vez costuma estar pondo o histórico em dia, tudo do mesmo dia.
      reset({ descricao: '', data: dados.data });
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Histórico de atendimentos</h2>
        <p className="text-muted-foreground text-sm">
          O que foi feito, quando. É o que substitui o caderno e o WhatsApp.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(aoEnviar)}
        method="post"
        className="flex flex-col gap-3"
        noValidate
      >
        {erro && <AvisoErro mensagem={erro} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="descricao-atendimento" className="text-sm font-medium">
            O que foi feito
          </label>
          <textarea
            id="descricao-atendimento"
            rows={2}
            placeholder="Visita técnica, troca de peça, retorno por telefone…"
            className="focus-visible:ring-ring focus-visible:border-ring rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            {...register('descricao')}
          />
          {errors.descricao && (
            <p className="text-destructive text-xs">{errors.descricao.message}</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Campo
            rotulo="Data"
            type="date"
            className="w-44"
            erro={errors.data?.message}
            {...register('data')}
          />

          <Botao type="submit" variante="secundario" carregando={salvando}>
            Registrar
          </Botao>
        </div>
      </form>

      {atendimentos.length === 0 ? (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Nenhum atendimento registrado ainda.
        </p>
      ) : (
        <ol className="flex flex-col border-t">
          {atendimentos.map((atendimento) => (
            <li
              key={atendimento.id}
              className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm whitespace-pre-wrap">{atendimento.descricao}</p>
                <time
                  dateTime={atendimento.data}
                  className="text-muted-foreground text-xs tabular-nums"
                >
                  {formatarData(atendimento.data)}
                </time>
              </div>

              <BotaoExcluir clienteId={clienteId} atendimentoId={atendimento.id} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BotaoExcluir({ clienteId, atendimentoId }: { clienteId: string; atendimentoId: string }) {
  const [removendo, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={removendo}
      onClick={() => iniciar(async () => void (await removerAtendimento(clienteId, atendimentoId)))}
      className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline disabled:opacity-50"
    >
      Excluir
    </button>
  );
}

/**
 * Formata a data sem passar por `new Date(string)`.
 *
 * `new Date('2026-08-13')` é interpretado como UTC e, no fuso do Brasil,
 * exibiria 12/08 — um dia a menos do que a pessoa registrou.
 */
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
