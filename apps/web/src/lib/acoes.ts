import { ApiRequestError } from './api';

export interface ResultadoAcao {
  erro?: string;
  campos?: Record<string, string[]>;
}

interface IssueValidacao {
  path: PropertyKey[];
  message: string;
}

export function agruparErros(issues: IssueValidacao[]): Record<string, string[]> {
  const campos: Record<string, string[]> = {};

  for (const issue of issues) {
    const campo = issue.path.join('.') || '_';
    (campos[campo] ??= []).push(issue.message);
  }

  return campos;
}

export function erroDeValidacao(issues: IssueValidacao[]): ResultadoAcao {
  return { erro: 'Confira os dados informados.', campos: agruparErros(issues) };
}

export function primeiroErro(issues: IssueValidacao[], padrao = 'Dados inválidos.'): ResultadoAcao {
  return { erro: issues[0]?.message ?? padrao };
}

export function traduzirErroAcao(
  erro: unknown,
  mensagemPadrao = 'Não foi possível completar a ação. Tente novamente.',
): ResultadoAcao {
  if (erro instanceof ApiRequestError) {
    return { erro: erro.erro.mensagem, campos: erro.erro.detalhes };
  }

  return { erro: mensagemPadrao };
}
