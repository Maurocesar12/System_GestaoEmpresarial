import { z } from 'zod';
import type { PapelUsuario } from '../enums';
export declare const loginSchema: z.ZodObject<
  {
    email: z.ZodPipe<z.ZodString, z.ZodEmail>;
    senha: z.ZodString;
  },
  z.core.$strip
>;
export type LoginInput = z.infer<typeof loginSchema>;
/** Política de senha aplicada no signup e na troca de senha. */
export declare const senhaSchema: z.ZodString;
export declare const signupSchema: z.ZodObject<
  {
    nomeEmpresa: z.ZodString;
    nomeResponsavel: z.ZodString;
    email: z.ZodPipe<z.ZodString, z.ZodEmail>;
    senha: z.ZodString;
  },
  z.core.$strip
>;
export type SignupInput = z.infer<typeof signupSchema>;
export declare const refreshTokenSchema: z.ZodObject<
  {
    refreshToken: z.ZodString;
  },
  z.core.$strip
>;
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
//# sourceMappingURL=auth.schemas.d.ts.map
