'use server';

import {
  chatIaSchema,
  type CapacidadesChat,
  type ChatIaResponse,
  type MensagemChat,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * O que o chat oferece a este usuário.
 *
 * Consultado ao abrir a janela: é o plano da empresa que decide se ela é a
 * ajuda do sistema ou o assistente com IA, e a tela precisa saber disso antes
 * da primeira pergunta para não se apresentar como o que não é.
 */
export async function carregarCapacidadesDoChat(): Promise<
  ResultadoAcao & { dados?: CapacidadesChat }
> {
  try {
    return { dados: await apiComSessao<CapacidadesChat>('/ia/chat/capacidades') };
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível abrir o assistente agora.');
  }
}

export async function perguntarParaIa(
  mensagem: string,
  historico: MensagemChat[] = [],
): Promise<ResultadoAcao & { dados?: ChatIaResponse }> {
  const validacao = chatIaSchema.safeParse({ mensagem, historico });
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? 'Digite uma pergunta válida.' };
  }

  try {
    return {
      dados: await apiComSessao<ChatIaResponse>('/ia/chat', {
        method: 'POST',
        body: JSON.stringify(validacao.data),
      }),
    };
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível falar com o assistente agora.');
  }
}
