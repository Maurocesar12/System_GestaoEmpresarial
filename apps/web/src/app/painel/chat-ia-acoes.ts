'use server';

import { chatIaSchema, type ChatIaResponse } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function perguntarParaIa(
  mensagem: string,
): Promise<ResultadoAcao & { dados?: ChatIaResponse }> {
  const validacao = chatIaSchema.safeParse({ mensagem });
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
    return traduzirErroAcao(erro, 'Não foi possível conversar com a IA agora.');
  }
}
