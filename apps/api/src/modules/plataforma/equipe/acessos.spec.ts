import {
  AREAS_ACESSO,
  PAPEIS_USUARIO,
  PERMISSOES,
  PERMISSOES_PADRAO_POR_PAPEL,
  acessosDasPermissoes,
  permissoesDosAcessos,
  type Permissao,
} from '@gestao/shared-types';

const ordenar = (lista: readonly string[]) => [...lista].sort();

describe('catálogo de acesso por área', () => {
  it('cobre cada permissão em exatamente uma área', () => {
    const vistas = AREAS_ACESSO.flatMap((area) => [
      ...new Set([...area.niveis.flatMap((n) => n.permissoes), ...area.extras.map((e) => e.codigo)]),
    ]);

    expect(ordenar(vistas)).toEqual(ordenar(PERMISSOES));
  });

  it('tem níveis acumulados: cada nível contém o anterior', () => {
    for (const area of AREAS_ACESSO) {
      area.niveis.forEach((nivel, indice) => {
        const anterior = area.niveis[indice - 1];
        if (anterior) expect(nivel.permissoes).toEqual(expect.arrayContaining([...anterior.permissoes]));
      });
    }
  });

  // Se um padrão não coubesse nos níveis, quem segue o padrão apareceria no
  // editor com acesso diferente do que tem — e salvar sem mexer mudaria tudo.
  it.each(PAPEIS_USUARIO)('lê e regrava o padrão de %s sem perder nada', (papel) => {
    const padrao = PERMISSOES_PADRAO_POR_PAPEL[papel];

    expect(ordenar(permissoesDosAcessos(acessosDasPermissoes(padrao)))).toEqual(ordenar(padrao));
  });

  it('não permite editar sem ver: a combinação solta cai para o nível completo', () => {
    const acessos = acessosDasPermissoes(['clientes.editar'] as Permissao[]);

    expect(acessos.clientes.nivel).toBe('nenhum');
    expect(permissoesDosAcessos(acessos)).toEqual([]);
  });

  it('ignora extras de uma área sem nível', () => {
    const permissoes = permissoesDosAcessos({
      financeiro: { nivel: 'nenhum', extras: ['financeiro.exportar'] },
    });

    expect(permissoes).toEqual([]);
  });

  it('ignora extra que não é da área', () => {
    const permissoes = permissoesDosAcessos({
      clientes: { nivel: 'ver', extras: ['financeiro.excluir'] },
    });

    expect(permissoes).toEqual(['clientes.visualizar']);
  });

  it('área só de extras liga cada item sozinho', () => {
    const permissoes = permissoesDosAcessos({
      administracao: { nivel: 'nenhum', extras: ['auditoria.visualizar'] },
    });

    expect(permissoes).toEqual(['auditoria.visualizar']);
  });
});
