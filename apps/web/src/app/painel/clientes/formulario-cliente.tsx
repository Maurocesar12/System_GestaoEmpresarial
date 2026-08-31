'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  clienteFormSchema,
  type Cliente,
  type ClienteFormEntrada,
  type ClienteFormInput,
} from '@gestao/shared-types';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { AreaTexto } from '@/components/ui/area-texto';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { mascararDocumento, mascararTelefone } from '@/lib/mascaras';
import { salvarCliente, type ResultadoAcao } from './acoes';

/** Campos do formulário, para o `setError` saber quais existem. */
const CAMPOS = ['nome', 'email', 'telefone', 'documento', 'observacoes', 'origem'] as const;

/**
 * Formulário de cadastro e edição de cliente.
 *
 * O mesmo componente serve aos dois casos: quando recebe um cliente, edita;
 * quando não recebe, cria. Duplicar a tela para "novo" e "editar" significaria
 * manter duas cópias das mesmas regras de validação e dos mesmos campos.
 */
export function FormularioCliente({ cliente }: { cliente?: Cliente }) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
    // Três parâmetros porque o schema transforma os dados: o formulário
    // trabalha com `ClienteFormEntrada` (tudo string, campos vazios como ""),
    // e o `handleSubmit` entrega `ClienteFormInput` (já normalizado, vazios
    // como null). Sem essa distinção, o TypeScript exigiria valor inicial
    // `null` nos campos opcionais e o input ficaria descontrolado.
  } = useForm<ClienteFormEntrada, unknown, ClienteFormInput>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: {
      nome: cliente?.nome ?? '',
      // Campos nulos viram string vazia: um `<input>` com valor `null` fica
      // descontrolado e o React reclama no console.
      email: cliente?.email ?? '',
      // Já mascarados na abertura: a API guarda só dígitos, e mostrar
      // "11912345678" na edição obrigaria a pessoa a conferir número a número.
      telefone: mascararTelefone(cliente?.telefone ?? ''),
      documento: mascararDocumento(cliente?.documento ?? ''),
      observacoes: cliente?.observacoes ?? '',
      origem: cliente?.origem ?? '',
    },
  });

  /**
   * Formata o campo quando a pessoa sai dele.
   *
   * Encapsula os dois passos que precisam acontecer juntos: escrever o valor
   * mascarado no formulário e continuar chamando o `onBlur` do próprio React
   * Hook Form — sem o segundo, o campo nunca seria marcado como "tocado" e a
   * validação no `blur` deixaria de rodar.
   */
  const aoSairFormatando = (
    campo: 'telefone' | 'documento',
    mascara: (valor: string) => string,
  ) => {
    const registro = register(campo);

    return {
      ...registro,
      onBlur: async (evento: React.FocusEvent<HTMLInputElement>) => {
        setValue(campo, mascara(evento.target.value));
        await registro.onBlur(evento);
      },
    };
  };

  const aoEnviar = (dados: ClienteFormInput) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarCliente(cliente?.id ?? null, dados);

      // Em caso de sucesso a action redireciona e nada aqui executa.
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
        rotulo="Nome"
        autoComplete="name"
        placeholder="Maria Souza"
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Telefone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="(11) 91234-5678"
          ajuda="Pode digitar só os números."
          erro={errors.telefone?.message}
          {...aoSairFormatando('telefone', mascararTelefone)}
        />

        <Campo
          rotulo="E-mail"
          type="email"
          placeholder="maria@exemplo.com"
          erro={errors.email?.message}
          {...register('email')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="CPF ou CNPJ"
          inputMode="numeric"
          placeholder="000.000.000-00"
          ajuda="Opcional. Pode digitar só os números."
          erro={errors.documento?.message}
          {...aoSairFormatando('documento', mascararDocumento)}
        />

        <Campo
          rotulo="Origem"
          ajuda="Como este cliente chegou até você."
          placeholder="Indicação, Instagram…"
          erro={errors.origem?.message}
          {...register('origem')}
        />
      </div>

      <AreaTexto
        rotulo="Observações"
        placeholder="Preferências, histórico, o que for útil lembrar."
        erro={errors.observacoes?.message}
        {...register('observacoes')}
      />

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {cliente ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Botao>

        <Link
          href="/painel/clientes"
          className="hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
