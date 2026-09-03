import { z } from 'zod';
import { papelUsuarioSchema, type PapelUsuario } from '../enums';
import { PERMISSOES, type Permissao } from './permissoes';

const emailEquipeSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));
const permissaoSchema = z.enum(PERMISSOES);

export const conviteEquipeSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  email: emailEquipeSchema,
  papel: papelUsuarioSchema.exclude(['admin']),
  permissoes: z.array(permissaoSchema).optional(),
});
export type ConviteEquipeInput = z.infer<typeof conviteEquipeSchema>;

export const aceitarConviteSchema = z.object({
  token: z.string().min(32),
  nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  senha: z.string().min(10, 'A senha precisa de pelo menos 10 caracteres').max(128),
});
export type AceitarConviteInput = z.infer<typeof aceitarConviteSchema>;

export const atualizarFuncionarioSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  papel: papelUsuarioSchema,
  ativo: z.boolean(),
  permissoes: z.array(permissaoSchema),
});
export type AtualizarFuncionarioInput = z.infer<typeof atualizarFuncionarioSchema>;

export interface Funcionario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  permissoes: Permissao[];
  permissoesPersonalizadas: boolean;
  ultimoLoginEm: string | null;
  criadoEm: string;
}

export interface ConviteEquipe {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  permissoes: Permissao[];
  expiraEm: string;
  criadoEm: string;
}

export interface EquipeResponse {
  funcionarios: Funcionario[];
  convites: ConviteEquipe[];
}
