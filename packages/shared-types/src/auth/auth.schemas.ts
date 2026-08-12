import { z } from 'zod';
import type { PapelUsuario } from '../enums';

/**
 * Contrato de autenticação (arquitetura §9.1).
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

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Política de senha aplicada no signup e na troca de senha. */
export const senhaSchema = z
  .string()
  .min(10, 'A senha precisa de pelo menos 10 caracteres')
  .max(128, 'Senha muito longa');

export const signupSchema = z.object({
  nomeEmpresa: z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  nomeResponsavel: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: emailSchema,
  senha: senhaSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

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
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  /** Segundos até o access token expirar. */
  expiresIn: number;
  usuario: UsuarioAutenticado;
}

/**
 * Claims do JWT. `tenantId` aqui é a origem do contexto de tenant no servidor
 * (arquitetura §4.2) — é o que alimenta o AsyncLocalStorage e, por consequência,
 * o filtro do Prisma e a política de RLS.
 */
export interface JwtPayload {
  /** subject — id do usuário */
  sub: string;
  tenantId: string;
  papel: PapelUsuario;
  iat?: number;
  exp?: number;
}
