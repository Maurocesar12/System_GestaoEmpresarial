import { z } from 'zod';
import { opcional } from '../common/opcional';

export const TIPOS_CAMPO_PERSONALIZADO = ['texto', 'numero', 'data', 'selecao'] as const;
export type TipoCampoPersonalizado = (typeof TIPOS_CAMPO_PERSONALIZADO)[number];

const campoSchema = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(2).max(80),
  tipo: z.enum(TIPOS_CAMPO_PERSONALIZADO),
  obrigatorio: z.boolean().default(false),
  opcoes: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});
const etiquetaSchema = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(1).max(40),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
});

export const configuracoesEmpresaSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    cnpj: opcional(
      z
        .string()
        .transform((valor) => valor.replace(/\D/g, ''))
        .refine((valor) => valor.length === 14, 'CNPJ inválido'),
    ),
    email: opcional(z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'))),
    telefone: opcional(
      z
        .string()
        .transform((valor) => valor.replace(/\D/g, ''))
        .refine((valor) => valor.length >= 10 && valor.length <= 11, 'Telefone inválido'),
    ),
    campos: z.array(campoSchema).max(30),
    etiquetas: z.array(etiquetaSchema).max(50),
  })
  .superRefine((dados, contexto) => {
    validarUnicos(dados.campos, 'campos', contexto);
    validarUnicos(dados.etiquetas, 'etiquetas', contexto);

    dados.campos.forEach((campo, indice) => {
      if (campo.tipo === 'selecao' && campo.opcoes.length === 0) {
        contexto.addIssue({
          code: 'custom',
          path: ['campos', indice, 'opcoes'],
          message: 'Informe ao menos uma opção para o campo de seleção',
        });
      }
    });
  });
export type ConfiguracoesEmpresaInput = z.infer<typeof configuracoesEmpresaSchema>;
export interface CampoPersonalizado extends Omit<z.infer<typeof campoSchema>, 'id'> {
  id: string;
}
export interface Etiqueta extends Omit<z.infer<typeof etiquetaSchema>, 'id'> {
  id: string;
}
export interface ConfiguracoesEmpresa extends Omit<
  ConfiguracoesEmpresaInput,
  'campos' | 'etiquetas'
> {
  campos: CampoPersonalizado[];
  etiquetas: Etiqueta[];
}

function validarUnicos(
  itens: Array<{ id?: string; nome: string }>,
  grupo: 'campos' | 'etiquetas',
  contexto: z.RefinementCtx,
): void {
  const nomes = new Set<string>();
  const ids = new Set<string>();

  itens.forEach((item, indice) => {
    const nome = item.nome.toLocaleLowerCase('pt-BR');
    if (nomes.has(nome)) {
      contexto.addIssue({
        code: 'custom',
        path: [grupo, indice, 'nome'],
        message: 'Use um nome diferente para cada item',
      });
    }
    nomes.add(nome);

    if (item.id && ids.has(item.id)) {
      contexto.addIssue({
        code: 'custom',
        path: [grupo, indice, 'id'],
        message: 'O mesmo item foi enviado mais de uma vez',
      });
    }
    if (item.id) ids.add(item.id);
  });
}
