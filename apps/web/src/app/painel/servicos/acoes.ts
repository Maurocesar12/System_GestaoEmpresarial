'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  FichaTecnica,
  Servico,
  ServicoFormEntrada,
  SimulacaoMargem,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

export async function salvarServico(
  id: string | null,
  dados: ServicoFormEntrada,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Servico>(id ? `/servicos/${id}` : '/servicos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
  }

  revalidatePath('/painel/servicos');
  redirect('/painel/servicos');
}

export async function salvarFichaTecnica(
  servicoId: string,
  itens: Array<{ materialId: string; quantidade: string }>,
): Promise<ResultadoAcao> {
  try {
    await apiComSessao<FichaTecnica>(`/servicos/${servicoId}/materiais`, {
      method: 'PUT',
      body: JSON.stringify({ itens }),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar a lista de materiais.');
  }

  revalidatePath(`/painel/servicos/${servicoId}`);
  return {};
}

/** Desativa o serviço. Ele some das listas novas, mas o histórico permanece. */
export async function desativarServico(id: string): Promise<ResultadoAcao> {
  try {
    await apiComSessao<Servico>(`/servicos/${id}`, { method: 'DELETE' });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível salvar. Tente novamente.');
  }

  revalidatePath('/painel/servicos');
  return {};
}

/** Prévia da margem, calculada pela API. Erro só some com a prévia. */
export async function simularMargem(dados: {
  custoBase: string;
  precoPadrao: string;
}): Promise<{ dados?: SimulacaoMargem }> {
  try {
    return {
      dados: await apiComSessao<SimulacaoMargem>('/servicos/simular-margem', {
        method: 'POST',
        body: JSON.stringify(dados),
      }),
    };
  } catch {
    return {};
  }
}
