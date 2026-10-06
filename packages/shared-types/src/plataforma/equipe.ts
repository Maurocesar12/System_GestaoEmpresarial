import { z } from 'zod';
import { papelUsuarioSchema, type PapelUsuario } from '../enums';
import { percentualComissaoOpcionalSchema } from '../operacao/comissoes';
import { mapaAcessosSchema, type CatalogoAcessos, type MapaAcessos } from './acessos';
import type { Permissao } from './permissoes';

const emailEquipeSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));

export const conviteEquipeSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  email: emailEquipeSchema,
  papel: papelUsuarioSchema.exclude(['admin']),
  /** Acesso por área. Ausente usa o padrão do papel. A API converte em permissões. */
  acessos: mapaAcessosSchema.optional(),
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
  /** Acesso por área. Ignorado para administrador, que sempre tem acesso total. */
  acessos: mapaAcessosSchema,
  /** Ausente mantém o que está gravado; vazio remove a comissão. */
  comissaoVendaPercentual: percentualComissaoOpcionalSchema.optional(),
  comissaoExecucaoPercentual: percentualComissaoOpcionalSchema.optional(),
});
export type AtualizarFuncionarioInput = z.infer<typeof atualizarFuncionarioSchema>;
export type AtualizarFuncionarioEntrada = z.input<typeof atualizarFuncionarioSchema>;

/** Pessoa ativa da equipe, para escolher vendedor e técnico. */
export interface PessoaEquipe {
  id: string;
  nome: string;
  papel: PapelUsuario;
}

export interface Funcionario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  permissoes: Permissao[];
  /** Difere do padrão do papel — calculado pela API comparando os conjuntos. */
  permissoesPersonalizadas: boolean;
  /** As permissões lidas como nível por área, para o editor de acesso. */
  acessos: MapaAcessos;
  comissaoVendaPercentual: string | null;
  comissaoExecucaoPercentual: string | null;
  ultimoLoginEm: string | null;
  criadoEm: string;
}

export interface ConviteEquipe {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  permissoes: Permissao[];
  acessos: MapaAcessos;
  expiraEm: string;
  criadoEm: string;
}

export interface EquipeResponse {
  funcionarios: Funcionario[];
  convites: ConviteEquipe[];
  capacidade: {
    planoSlug: string;
    planoNome: string;
    planoDescricao: string;
    planoNivel: number;
    planoDestaque: boolean;
    precoBase: string;
    limiteUsuarios: number | null;
    usuariosAtivos: number;
    convitesPendentes: number;
    vagasOcupadas: number;
    vagasDisponiveis: number | null;
    /** Vagas ocupadas sobre o limite, de 0 a 100. Zero quando o plano não tem limite. */
    percentualOcupado: number;
    /** Sem vaga para convidar mais ninguém — a API recusa o convite. */
    limiteAtingido: boolean;
    usuariosInclusos: number | null;
    usuariosAdicionais: number;
    precoPorUsuarioAdicional: string;
    adicionalUsuarios: string;
    mensalidadeEstimada: string;
    proximoPlano: {
      slug: string;
      nome: string;
      nivel: number;
      preco: string;
      usuariosInclusos: number | null;
      limiteUsuarios: number | null;
      precoPorUsuarioAdicional: string;
    } | null;
  };
  /** Áreas, níveis, papéis e o acesso padrão de cada papel — tudo da API. */
  catalogo: CatalogoAcessos;
}
