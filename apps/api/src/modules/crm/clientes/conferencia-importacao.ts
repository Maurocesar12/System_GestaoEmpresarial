import { clienteFormSchema, type LinhaClienteConferida } from '@gestao/shared-types';

/**
 * Confere cada linha da planilha com o **mesmo** schema do cadastro.
 *
 * Morava na tela, que validava a planilha antes de enviar. Saiu de lá porque
 * regra é da API: a conferência e a importação precisam aceitar exatamente a
 * mesma coisa, e duas validações em lugares diferentes acabam divergindo — a
 * divergência apareceria como linha "válida" na prévia que a importação
 * recusa, ou o contrário.
 *
 * Não grava nada e não olha o banco: duplicidade (e-mail, documento) é
 * decidida na importação, que já devolve o motivo de cada linha ignorada.
 */
export function conferirLinhasDeClientes(
  linhas: Record<string, unknown>[],
): LinhaClienteConferida[] {
  return linhas.map((linha) => {
    const resultado = clienteFormSchema.safeParse(linha);

    if (resultado.success) {
      return { valida: true, erros: [], dados: resultado.data };
    }

    // O nome do campo só quando não é óbvio: "Informe o nome" já diz qual é.
    const erros = resultado.error.issues.map((problema) => {
      const campo = problema.path[0];
      return campo && campo !== 'nome' ? `${String(campo)}: ${problema.message}` : problema.message;
    });

    return { valida: false, erros, dados: null };
  });
}
