'use server';

import { redirect } from 'next/navigation';
import type {
  AtivacaoDoisFatores,
  CadastroInput,
  ConfiguracaoDoisFatores,
  DesafioDoisFatores,
  LoginInput,
  SessaoResponse,
} from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiFetch } from '@/lib/api';
import { seguirParaDoisFatores } from '@/lib/dois-fatores';
import {
  gravarDesafio,
  gravarSessao,
  lerDesafio,
  lerRefreshToken,
  limparDesafio,
  limparSessao,
} from '@/lib/sessao';

/**
 * Ações de sessão, executadas no servidor.
 *
 * São Server Actions: o formulário do navegador as chama, mas o código roda no
 * servidor do Next. É o que permite gravar o cookie `httpOnly` — algo que o
 * JavaScript da página, por definição, não consegue fazer.
 *
 * O token nunca chega ao navegador em lugar nenhum: a API o devolve aqui, e
 * daqui ele vai direto para o cookie.
 *
 * Nenhuma das portas de entrada (login, cadastro, convite) abre sessão: todas
 * terminam no desafio do 2FA, e a sessão só nasce em `verificarDoisFatores` ou
 * `ativarDoisFatores`.
 */

const SEM_DESAFIO = 'A verificação expirou. Entre com e-mail e senha de novo.';

export async function entrar(dados: LoginInput): Promise<ResultadoAcao> {
  // Sem validação aqui: quem valida é a API, e os erros por campo voltam em
  // `campos`. Ver `lib/acoes.ts`.
  let resposta: DesafioDoisFatores;
  try {
    resposta = await apiFetch<DesafioDoisFatores>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  // `redirect` fica fora do try: por dentro ele funciona lançando uma exceção
  // especial, que o catch acima engoliria — e a navegação nunca aconteceria.
  return seguirParaDoisFatores(resposta);
}

export async function cadastrar(dados: CadastroInput): Promise<ResultadoAcao> {
  let resposta: DesafioDoisFatores;
  try {
    resposta = await apiFetch<DesafioDoisFatores>('/onboarding/cadastro', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  return seguirParaDoisFatores(resposta);
}

export type ResultadoConfiguracao = ResultadoAcao & {
  configuracao?: Omit<ConfiguracaoDoisFatores, 'desafio'>;
};

/**
 * Gera o QR code do primeiro acesso.
 *
 * O desafio novo, que carrega o segredo cifrado, substitui o anterior no
 * cookie — a tela recebe só a imagem e o segredo para digitar à mão.
 */
export async function prepararConfiguracao(): Promise<ResultadoConfiguracao> {
  const desafio = await lerDesafio();
  if (!desafio) return { erro: SEM_DESAFIO };

  try {
    const { desafio: novo, ...configuracao } = await apiFetch<ConfiguracaoDoisFatores>(
      '/auth/2fa/configuracao',
      { method: 'POST', body: JSON.stringify({ desafio }) },
    );
    await gravarDesafio(novo);
    return { configuracao };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}

export type ResultadoAtivacao = ResultadoAcao & { codigosRecuperacao?: string[] };

/**
 * Confirma o primeiro código e abre a sessão.
 *
 * Não redireciona: a tela ainda precisa mostrar os códigos de recuperação,
 * que a API entrega uma única vez. O botão "Continuar" é que leva ao painel.
 */
export async function ativarDoisFatores(codigo: string): Promise<ResultadoAtivacao> {
  const desafio = await lerDesafio();
  if (!desafio) return { erro: SEM_DESAFIO };

  try {
    const { sessao, codigosRecuperacao } = await apiFetch<AtivacaoDoisFatores>('/auth/2fa/ativar', {
      method: 'POST',
      body: JSON.stringify({ desafio, codigo }),
    });
    await gravarSessao(sessao);
    await limparDesafio();
    return { codigosRecuperacao };
  } catch (erro) {
    return traduzirErroAcao(erro);
  }
}

/** Login de quem já tem o app: código de 6 dígitos ou de recuperação. */
export async function verificarDoisFatores(codigo: string): Promise<ResultadoAcao> {
  const desafio = await lerDesafio();
  if (!desafio) return { erro: SEM_DESAFIO };

  try {
    const sessao = await apiFetch<SessaoResponse>('/auth/2fa/verificar', {
      method: 'POST',
      body: JSON.stringify({ desafio, codigo }),
    });
    await gravarSessao(sessao);
    await limparDesafio();
  } catch (erro) {
    return traduzirErroAcao(erro);
  }

  redirect('/painel');
}

export async function sair(): Promise<void> {
  const refreshToken = await lerRefreshToken();

  if (refreshToken) {
    try {
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Se a API não responder, seguimos e limpamos o cookie mesmo assim: para
      // quem clicou em "sair", o resultado esperado é sair.
    }
  }

  await limparSessao();
  redirect('/entrar');
}
