'use server';
import { revalidatePath } from 'next/cache';
import {
  configuracoesEmpresaSchema,
  testeEmailSchema,
  type ConfiguracoesEmpresa,
  type ConfiguracoesEmpresaInput,
  type TesteEmailResponse,
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

export async function testarEmail(
  email: string,
): Promise<ResultadoAcao & { modo?: TesteEmailResponse['modo'] }> {
  const validacao = testeEmailSchema.safeParse({ email });
  if (!validacao.success) return erroDeValidacao(validacao.error.issues);

  try {
    return await apiComSessao<TesteEmailResponse>('/configuracoes/email/testar', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível enviar o e-mail de teste.');
  }
}
