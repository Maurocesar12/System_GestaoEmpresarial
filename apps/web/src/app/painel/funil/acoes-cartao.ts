'use server';

import { revalidatePath } from 'next/cache';
import {
  atendimentoFormSchema,
  clienteFormSchema,
  type Atendimento,
  type AtendimentoFormInput,
  type Cliente,
} from '@gestao/shared-types';
import { primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/** O que o cartão aberto mostra. */
export interface DetalheCartao {
  cliente: Cliente;
  atendimentos: Atendimento[];
}

/**
 * Carrega o conteúdo do cartão quando ele é aberto.
 *
 * Sob demanda, e não junto do quadro: as observações e o histórico de cada
 * cliente somariam vários kilobytes por cartão, e o quadro carrega dezenas
 * deles para mostrar nome e valor. Quem abre um cartão paga por um.
 *
 * As duas chamadas vão juntas porque são independentes — em série, a segunda
 * esperaria a primeira sem motivo.
 */
export async function carregarCartao(
  clienteId: string,
): Promise<{ detalhe?: DetalheCartao; erro?: string }> {
  try {
    const [cliente, atendimentos] = await Promise.all([
      apiComSessao<Cliente>(`/clientes/${clienteId}`),
      apiComSessao<Atendimento[]>(`/clientes/${clienteId}/atendimentos`),
    ]);

    return { detalhe: { cliente, atendimentos } };
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível abrir o cartão.');
  }
}

/**
 * Salva nome e descrição editados dentro do cartão.
 *
 * A API atualiza o cliente inteiro, e não campo a campo. Por isso o cliente
 * atual é lido antes e os campos alterados são mesclados: enviar só `nome` e
 * `observacoes` apagaria telefone, e-mail e documento — que a tela do funil
 * nem mostra, e o usuário não faz ideia de estar mexendo.
 */
export async function salvarCartao(
  clienteId: string,
  alteracoes: { nome: string; observacoes: string },
): Promise<ResultadoAcao> {
  let atual: Cliente;

  try {
    atual = await apiComSessao<Cliente>(`/clientes/${clienteId}`);
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível carregar o cliente.');
  }

  const validacao = clienteFormSchema.safeParse({
    nome: alteracoes.nome,
    observacoes: alteracoes.observacoes,
    // Preservados como estão: o cartão não os edita.
    email: atual.email ?? '',
    telefone: atual.telefone ?? '',
    documento: atual.documento ?? '',
    origem: atual.origem ?? '',
    utmSource: atual.utmSource ?? '',
    utmMedium: atual.utmMedium ?? '',
    utmCampaign: atual.utmCampaign ?? '',
  });

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<Cliente>(`/clientes/${clienteId}`, {
      method: 'PATCH',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
  }

  revalidatePath('/painel/funil');
  revalidatePath(`/painel/clientes/${clienteId}`);
  return {};
}

/**
 * Registra um atendimento sem sair do cartão.
 *
 * Devolve o registro criado, e não só "deu certo". O motivo é concreto: o
 * `revalidatePath` atualiza a página renderizada no servidor, mas o cartão
 * aberto é um componente de cliente que carregou o histórico uma vez. Sem o
 * registro de volta, a anotação era gravada e **não aparecia** até fechar e
 * reabrir o cartão — parecia que o botão não tinha funcionado.
 */
export async function anotarNoCartao(
  clienteId: string,
  dados: AtendimentoFormInput,
): Promise<ResultadoAcao & { atendimento?: Atendimento }> {
  const validacao = atendimentoFormSchema.safeParse(dados);

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  let atendimento: Atendimento;

  try {
    atendimento = await apiComSessao<Atendimento>(`/clientes/${clienteId}/atendimentos`, {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível registrar. Tente novamente.');
  }

  revalidatePath('/painel/funil');
  revalidatePath(`/painel/clientes/${clienteId}`);
  return { atendimento };
}
