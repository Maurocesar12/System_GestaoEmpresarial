import { PERMISSOES, PERMISSOES_PADRAO_POR_PAPEL, permissoesDoUsuario } from '@gestao/shared-types';

describe('permissões por ação', () => {
  it('administrador recebe todas as ações conhecidas', () => {
    expect(permissoesDoUsuario('admin', undefined)).toEqual(PERMISSOES);
  });

  it('lista personalizada vazia remove todo acesso', () => {
    expect(permissoesDoUsuario('atendente', [])).toEqual([]);
  });

  it('papel financeiro não recebe exclusão de clientes', () => {
    expect(PERMISSOES_PADRAO_POR_PAPEL.financeiro).not.toContain('clientes.excluir');
  });

  it('ignora códigos antigos ou adulterados vindos do banco', () => {
    expect(permissoesDoUsuario('tecnico', ['agenda.visualizar', 'nao.existe'])).toEqual([
      'agenda.visualizar',
    ]);
  });
});
