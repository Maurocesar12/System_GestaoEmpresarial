'use server';

import { revalidatePath } from 'next/cache';
import {
  clienteFormSchema,
  type Cliente,
  type ClienteFormInput,
  type MoverClienteInput,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Move um cliente de etapa.
 *
 * Chamada quando o cartão é solto em outra coluna. A tela já atualizou o
 * visual antes de esta ação terminar (atualização otimista); se der erro, ela
 * desfaz e mostra a mensagem.
 */
export async function moverCliente(dados: MoverClienteInput): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>('/funil/mover', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível mover o cliente. Tente novamente.');
  }

  revalidatePath('/painel/funil');
  return {};
}

export async function removerDoFunil(clienteId: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/funil/clientes/${clienteId}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível mover o cliente. Tente novamente.');
  }

  revalidatePath('/painel/funil');
  return {};
}

/**
 * Cria um cliente já na coluna escolhida.
 *
 * É o "adicionar cartão" do quadro: quem está olhando o funil quer registrar o
 * lead sem sair da tela e sem preencher a ficha inteira — o resto do cadastro
 * fica para depois, na página do cliente.
 *
 * São duas chamadas porque a API cria todo cliente na primeira etapa. Se a
 * segunda falhar, o cliente **existe** e está na primeira coluna: nada se
 * perde, e a mensagem de erro diz o que houve. Fundir as duas num endpoint só
 * evitaria essa viagem extra, mas mudaria o contrato de criação de cliente por
 * causa de um caso de uso de uma tela.
 */
export async function adicionarCartao(
  etapaId: string,
  dados: ClienteFormInput,
): Promise<ResultadoAcao> {
  const validacao = clienteFormSchema.safeParse(dados);

  if (!validacao.success) {
    return erroDeValidacao(validacao.error.issues);
  }

  let cliente: Cliente;

  try {
    cliente = await apiComSessao<Cliente>('/clientes', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível criar o cliente. Tente novamente.');
  }

  // Já caiu na coluna certa quando a etapa escolhida é a primeira.
  if (cliente.etapaFunil?.id !== etapaId) {
    try {
      await apiComSessao<void>('/funil/mover', {
        method: 'POST',
        body: JSON.stringify({ clienteId: cliente.id, etapaId }),
      });
    } catch (erro) {
      revalidatePath('/painel/funil');
      return traduzirErroAcao(
        erro,
        'O cliente foi criado, mas ficou na primeira etapa. Arraste-o para a coluna certa.',
      );
    }
  }

  revalidatePath('/painel/funil');
  return {};
}
