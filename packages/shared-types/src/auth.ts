import { z } from 'zod';
import type { PapelUsuario } from './enums';
import type { Permissao } from './plataforma/permissoes';
import type { SituacaoDeAcesso } from './plataforma/acesso';

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
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));

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
  // Mesmo teto do cadastro, e aqui importa mais: a rota de entrada é pública,
  // e cada tentativa custa um Argon2id no servidor.
  senha: z.string().min(1, 'Informe a senha').max(128, 'Senha ou e-mail incorretos.'),
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

export const refreshTokenSchema = z.object({
  // O token real tem ~80 caracteres (`tenantId.aleatório`); o teto só barra lixo grande.
  refreshToken: z.string().min(1).max(256),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** Usuário autenticado, como o frontend o enxerga. Nunca inclui hash de senha. */
export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  permissoes: Permissao[];
  tenantId: string;
  /** Nome da empresa, para exibir no cabeçalho sem uma segunda requisição. */
  nomeEmpresa: string;
  /**
   * Até quando a empresa tem acesso, e por quê.
   *
   * Viaja junto da sessão para o painel conseguir avisar do vencimento sem uma
   * requisição extra a cada carregamento — o aviso precisa aparecer no
   * primeiro instante depois do login, que é quando a pessoa está olhando.
   */
  acesso: SituacaoDeAcesso;
}

export interface SessaoResponse {
  accessToken: string;
  refreshToken: string;
  /** Segundos até o access token expirar. O frontend usa para renovar antes. */
  expiraEm: number;
  usuario: UsuarioAutenticado;
}

/**
 * Verificação em duas etapas — obrigatória para todo login.
 *
 * Senha certa não abre sessão: login, cadastro e aceite de convite devolvem um
 * `DesafioDoisFatores`. A sessão só nasce em `/auth/2fa/verificar` (quem já tem
 * o app configurado) ou `/auth/2fa/ativar` (quem configura agora).
 */
export interface DesafioDoisFatores {
  etapa: 'dois_fatores';
  /** Token curto (10 min) que prova que a senha já foi conferida. Não abre rota nenhuma. */
  desafio: string;
  /** `true`: a pessoa ainda não tem o app configurado e precisa ver o QR code. */
  configurar: boolean;
}

const desafioCampo = z.string().min(1).max(4096);

export const desafioDoisFatoresSchema = z.object({ desafio: desafioCampo });
export type DesafioDoisFatoresInput = z.infer<typeof desafioDoisFatoresSchema>;

export const codigoDoisFatoresSchema = z.object({
  desafio: desafioCampo,
  /** Os 6 dígitos que o app autenticador mostra. */
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Digite os 6 números que aparecem no app autenticador'),
});
export type CodigoDoisFatoresInput = z.infer<typeof codigoDoisFatoresSchema>;

/** O que a tela de configuração mostra. */
export interface ConfiguracaoDoisFatores {
  /** Desafio novo, que carrega o segredo cifrado até a ativação. */
  desafio: string;
  /** Para digitar à mão quando a câmera não lê o QR, em grupos de 4. */
  segredo: string;
  /** Imagem do QR code em `data:` URL. */
  qrCode: string;
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
  tipo: 'acesso';
  /** subject — id do usuário */
  sub: string;
  tenantId: string;
  papel: PapelUsuario;
  permissoes: Permissao[];
  /** emitido em (epoch, segundos) */
  iat?: number;
  /** expira em (epoch, segundos) */
  exp?: number;
}
