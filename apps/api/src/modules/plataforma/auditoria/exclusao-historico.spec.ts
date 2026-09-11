import { exclusaoHistoricoSchema, LIMITE_EXCLUSAO_HISTORICO } from '@gestao/shared-types';

/**
 * O schema da exclusão em lote é a única barreira entre a seleção da tela e um
 * `deleteMany` — ele decide o que chega ao banco, e por isso é testado sozinho.
 */
const id = (final: number): string =>
  `0198f1a0-0000-7000-8000-${final.toString().padStart(12, '0')}`;

describe('exclusaoHistoricoSchema', () => {
  it('remove ids repetidos', () => {
    const resultado = exclusaoHistoricoSchema.parse({ ids: [id(1), id(2), id(1)] });

    expect(resultado.ids).toEqual([id(1), id(2)]);
  });

  it('recusa lista vazia', () => {
    expect(exclusaoHistoricoSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it('recusa id que não é uuid', () => {
    expect(exclusaoHistoricoSchema.safeParse({ ids: ['nao-e-uuid'] }).success).toBe(false);
  });

  it('recusa lote acima do limite', () => {
    const ids = Array.from({ length: LIMITE_EXCLUSAO_HISTORICO + 1 }, (_, indice) => id(indice));

    expect(exclusaoHistoricoSchema.safeParse({ ids }).success).toBe(false);
  });

  it('aceita exatamente o limite', () => {
    const ids = Array.from({ length: LIMITE_EXCLUSAO_HISTORICO }, (_, indice) => id(indice));

    expect(exclusaoHistoricoSchema.parse({ ids }).ids).toHaveLength(LIMITE_EXCLUSAO_HISTORICO);
  });

  // Validado duas vezes: na Server Action e de novo no pipe da API. A segunda
  // passada recebe o resultado da primeira e precisa aceitá-lo.
  it('aceita de volta o próprio resultado', () => {
    const primeira = exclusaoHistoricoSchema.parse({ ids: [id(1), id(1), id(2)] });

    expect(exclusaoHistoricoSchema.parse(primeira)).toEqual(primeira);
  });
});
