'use server';
import { revalidatePath } from 'next/cache';
import {
  configuracoesEmpresaSchema,
  type ConfiguracoesEmpresa,
  type ConfiguracoesEmpresaInput,
} from '@gestao/shared-types';
import { erroDeValidacao, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';
export async function salvarConfiguracoes(
  dados: ConfiguracoesEmpresaInput,
): Promise<ResultadoAcao & { configuracoes?: ConfiguracoesEmpresa }> {
  const validacao = configuracoesEmpresaSchema.safeParse(dados);
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);
  try {
    const configuracoes = await apiComSessao<ConfiguracoesEmpresa>('/configuracoes', {
      method: 'PUT',
      body: JSON.stringify(validacao.data),
    });
    revalidatePath('/painel', 'layout');
    return { configuracoes };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}
