'use server';

import { revalidatePath } from 'next/cache';
import {
  etapaFormSchema,
  reordenarEtapasSchema,
  type EtapaFormInput,
  type EtapaFunil,
} from '@gestao/shared-types';
import { primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function criarEtapa(dados: EtapaFormInput): Promise<ResultadoAcao> {
  const validacao = etapaFormSchema.safeParse(dados);

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<EtapaFunil>('/funil/etapas', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidar();
  return {};
}

export async function renomearEtapa(id: string, nome: string): Promise<ResultadoAcao> {
  const validacao = etapaFormSchema.safeParse({ nome });

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<EtapaFunil>(`/funil/etapas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidar();
  return {};
}

export async function excluirEtapa(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<void>(`/funil/etapas/${id}`, { method: 'DELETE' });
  } catch (erro) {
    // A API recusa etapa com clientes dentro, e a mensagem dela diz quantos
    // são — bem mais útil que um "não foi possível excluir".
    return traduzirErroAcao(erro);
  }

  revalidar();
  return {};
}

export async function reordenarEtapas(etapaIds: string[]): Promise<ResultadoAcao> {
  const validacao = reordenarEtapasSchema.safeParse({ etapaIds });

  if (!validacao.success) {
    return primeiroErro(validacao.error.issues, 'Ordem inválida.');
  }

  try {
    await apiComSessao<EtapaFunil[]>('/funil/etapas/ordem', {
      method: 'PUT',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  revalidar();
  return {};
}

/**
 * Mudar a estrutura do funil afeta o quadro e a tela de etapas.
 *
 * Sem invalidar as duas, o quadro continuaria mostrando as colunas antigas até
 * alguém recarregar a página na mão.
 */
function revalidar(): void {
  revalidatePath('/painel/funil');
  revalidatePath('/painel/funil/etapas');
}
