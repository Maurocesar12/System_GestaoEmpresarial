'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.refreshTokenSchema =
  exports.signupSchema =
  exports.senhaSchema =
  exports.loginSchema =
    void 0;
const zod_1 = require('zod');
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
const emailSchema = zod_1.z.string().trim().toLowerCase().pipe(zod_1.z.email('E-mail inválido'));
exports.loginSchema = zod_1.z.object({
  email: emailSchema,
  senha: zod_1.z.string().min(1, 'Informe a senha'),
});
/** Política de senha aplicada no signup e na troca de senha. */
exports.senhaSchema = zod_1.z
  .string()
  .min(10, 'A senha precisa de pelo menos 10 caracteres')
  .max(128, 'Senha muito longa');
exports.signupSchema = zod_1.z.object({
  nomeEmpresa: zod_1.z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  nomeResponsavel: zod_1.z.string().trim().min(2, 'Informe seu nome').max(120),
  email: emailSchema,
  senha: exports.senhaSchema,
});
exports.refreshTokenSchema = zod_1.z.object({
  refreshToken: zod_1.z.string().min(1),
});
//# sourceMappingURL=auth.schemas.js.map
