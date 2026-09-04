import { Prisma } from '../../../generated/prisma/client';

interface DadosDaMensalidade {
  precoBase: Prisma.Decimal;
  usuariosAtivos: number;
  usuariosInclusos: number | null;
  precoUsuarioAdicional: Prisma.Decimal;
}

/**
 * Calcula a mensalidade sem usar ponto flutuante para valores monetários.
 *
 * Apenas usuários ativos entram na conta. Convites pendentes reservam uma vaga
 * do plano, mas só passam a gerar adicional depois que forem aceitos.
 */
export function calcularMensalidade(dados: DadosDaMensalidade) {
  const usuariosAdicionais =
    dados.usuariosInclusos === null
      ? 0
      : Math.max(0, dados.usuariosAtivos - dados.usuariosInclusos);
  const adicionalUsuarios = dados.precoUsuarioAdicional.times(usuariosAdicionais);

  return {
    usuariosAdicionais,
    adicionalUsuarios,
    mensalidade: dados.precoBase.plus(adicionalUsuarios),
  };
}
