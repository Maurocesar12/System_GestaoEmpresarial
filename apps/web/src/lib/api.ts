import { CODIGOS_ERRO, type ApiError } from '@gestao/shared-types';
import { env } from './env';

/**
 * Erro vindo da API, já no formato único de `ApiError`.
 *
 * Carregar o `codigo` (e não só a mensagem) é o que permite ao frontend
 * reagir de forma diferente a cada situação — redirecionar para o login em
 * `NAO_AUTENTICADO`, abrir a tela de plano em `LIMITE_PLANO_EXCEDIDO` — sem
 * comparar texto de mensagem.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly erro: ApiError,
  ) {
    super(erro.mensagem);
    this.name = 'ApiRequestError';
  }
}

/** Prefixo global da API. `/health` é a única rota fora dele. */
const PREFIXO = '/api';

/**
 * Cliente HTTP da API.
 *
 * O access token ainda não é enviado aqui — entra junto com o AuthModule, lido
 * do cookie httpOnly no servidor e repassado como header `Authorization`.
 */
export async function apiFetch<T>(
  caminho: string,
  init: RequestInit & { semPrefixo?: boolean } = {},
): Promise<T> {
  const { semPrefixo, ...requestInit } = init;
  const url = `${env.NEXT_PUBLIC_API_URL}${semPrefixo ? '' : PREFIXO}${caminho}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      ...requestInit,
      headers: {
        'Content-Type': 'application/json',
        ...requestInit.headers,
      },
    });
  } catch (causa) {
    // Rede fora do ar / API dormindo: sem isso o erro chega como um
    // "fetch failed" cru, sem o formato que o resto do app espera tratar.
    //
    // A mensagem diz o endereço que falhou e o que fazer. "Erro de conexão"
    // sozinho manda quem está desenvolvendo caçar no console; dizer que a API
    // em tal endereço não respondeu aponta direto para a causa — quase sempre
    // a API não está no ar, ou a URL configurada está errada.
    const detalhe = causa instanceof Error ? causa.message : String(causa);

    throw new ApiRequestError(0, {
      codigo: CODIGOS_ERRO.ERRO_INTERNO,
      mensagem: `Não foi possível falar com a API em ${env.NEXT_PUBLIC_API_URL}. Verifique se ela está rodando.`,
      detalhes: { conexao: [detalhe] },
    });
  }

  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      resposta.status,
      erro ?? {
        codigo: CODIGOS_ERRO.ERRO_INTERNO,
        mensagem: 'Erro inesperado ao falar com o servidor.',
      },
    );
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  return (await resposta.json()) as T;
}
