import {
  exigirContextoTenant,
  obterContextoTenant,
  runComTenant,
  type TenantContext,
} from './tenant-context';

const contextoA: TenantContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  usuarioId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  papel: 'admin',
  requestId: 'req-a',
};

const contextoB: TenantContext = {
  tenantId: '22222222-2222-2222-2222-222222222222',
  usuarioId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  papel: 'atendente',
  requestId: 'req-b',
};

describe('contexto de tenant', () => {
  it('devolve o contexto de dentro do escopo', () => {
    runComTenant(contextoA, () => {
      expect(exigirContextoTenant().tenantId).toBe(contextoA.tenantId);
    });
  });

  it('não vaza contexto para fora do escopo', () => {
    runComTenant(contextoA, () => obterContextoTenant());
    expect(obterContextoTenant()).toBeUndefined();
  });

  it('falha alto fora de qualquer escopo', () => {
    // Silêncio aqui seria o pior resultado possível: consulta sem tenant é
    // exatamente o caminho por onde dado de uma empresa vaza para outra.
    expect(() => exigirContextoTenant()).toThrow(/fora de um contexto válido/);
  });

  it('mantém escopos concorrentes isolados entre si', async () => {
    // Duas requisições simultâneas de tenants diferentes: cada uma precisa
    // enxergar apenas o próprio contexto, mesmo intercalando await.
    const lerAposEspera = async (contexto: TenantContext, atraso: number): Promise<string> =>
      runComTenant(contexto, async () => {
        await new Promise((resolve) => setTimeout(resolve, atraso));
        return exigirContextoTenant().tenantId;
      });

    const [lidoA, lidoB] = await Promise.all([
      lerAposEspera(contextoA, 20),
      lerAposEspera(contextoB, 5),
    ]);

    expect(lidoA).toBe(contextoA.tenantId);
    expect(lidoB).toBe(contextoB.tenantId);
  });

  it('isola escopos aninhados sem contaminar o externo', () => {
    runComTenant(contextoA, () => {
      runComTenant(contextoB, () => {
        expect(exigirContextoTenant().tenantId).toBe(contextoB.tenantId);
      });
      expect(exigirContextoTenant().tenantId).toBe(contextoA.tenantId);
    });
  });
});
