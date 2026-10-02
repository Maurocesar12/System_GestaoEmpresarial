'use server';
import { revalidatePath } from 'next/cache';
import type {
  ConfiguracoesEmpresa,
  ConfiguracoesEmpresaInput,
  TesteEmailResponse,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';
export async function salvarConfiguracoes(
  dados: ConfiguracoesEmpresaInput,
): Promise<ResultadoAcao & { configuracoes?: ConfiguracoesEmpresa }> {
  try {
    const configuracoes = await apiComSessao<ConfiguracoesEmpresa>('/configuracoes', {
      method: 'PUT',
      body: JSON.stringify(dados),
    });
    revalidatePath('/painel', 'layout');
    return { configuracoes };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}

export async function testarEmail(
  email: string,
): Promise<ResultadoAcao & { modo?: TesteEmailResponse['modo'] }> {
  try {
    return await apiComSessao<TesteEmailResponse>('/configuracoes/email/testar', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível enviar o e-mail de teste.');
  }
}
