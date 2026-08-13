import { z } from 'zod';
import type { PapelUsuario } from '../enums';

/**
 * Contrato de autenticação (arquitetura §9.1).
 *
 * Estes schemas são a fonte única de validação: a API os usa no
 * `ZodValidationPipe`, e o formulário do frontend os usa no React Hook Form.
 * Uma regra escrita uma vez só não tem como divergir entre os dois lados.
 *
 * O access token é devolvido no corpo da resposta; o Next.js é quem o grava em
 * cookie httpOnly. A API nunca seta cookie — frontend e API vivem em domínios
 * diferentes.
 */

/**
 * E-mail normalizado antes de validar: o usuário digita " Joao@Empresa.com "
 * e isso precisa bater com o registro gravado como "joao@empresa.com".
 */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));

/**
 * Política de senha.
 *
 * Comprimento mínimo em vez de exigir símbolo, número e maiúscula. É a
 * recomendação atual do NIST: regras de composição empurram as pessoas para
 * senhas previsíveis do tipo "Senha1!", enquanto o comprimento é o que
 * realmente encarece um ataque de força bruta.
 */
export const senhaSchema = z
  .string()
  .min(10, 'A senha precisa de pelo menos 10 caracteres')
  // O Argon2id não tem limite prático, mas um teto evita que alguém envie
  // megabytes de texto só para consumir CPU do servidor a cada tentativa.
  .max(128, 'A senha pode ter no máximo 128 caracteres');

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const cadastroSchema = z.object({
  nomeEmpresa: z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  nomeResponsavel: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: emailSchema,
  senha: senhaSchema,
});
export type CadastroInput = z.infer<typeof cadastroSchema>;

/** Mantido como alias: `signup` é o nome usado no documento de arquitetura. */
export const signupSchema = cadastroSchema;
export type SignupInput = CadastroInput;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** Usuário autenticado, como o frontend o enxerga. Nunca inclui hash de senha. */
export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  tenantId: string;
  /** Nome da empresa, para exibir no cabeçalho sem uma segunda requisição. */
  nomeEmpresa: string;
}

export interface SessaoResponse {
  accessToken: string;
  refreshToken: string;
  /** Segundos até o access token expirar. O frontend usa para renovar antes. */
  expiraEm: number;
  usuario: UsuarioAutenticado;
}

/**
 * Claims do JWT.
 *
 * `tenantId` aqui é a origem do contexto de tenant no servidor (§4.2) — é o que
 * alimenta o AsyncLocalStorage e, por consequência, o filtro do Prisma e a
 * política de RLS. Um token adulterado não ajuda: a assinatura é verificada
 * antes de qualquer claim ser lido.
 */
export interface JwtPayload {
  /** subject — id do usuário */
  sub: string;
  tenantId: string;
  papel: PapelUsuario;
  /** emitido em (epoch, segundos) */
  iat?: number;
  /** expira em (epoch, segundos) */
  exp?: number;
}
