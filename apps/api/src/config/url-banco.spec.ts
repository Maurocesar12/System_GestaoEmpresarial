import { urlAdministrativa } from './url-banco';

const APP = 'postgresql://app@localhost:5432/gestao';
const ADMIN = 'postgresql://admin@localhost:5432/gestao';
const TESTE = 'postgresql://app@localhost:5432/gestao_teste';

describe('urlAdministrativa', () => {
  it('prefere a conexão administrativa quando ela existe', () => {
    expect(urlAdministrativa({ ADMIN_DATABASE_URL: ADMIN, DATABASE_URL: APP })).toBe(ADMIN);
  });

  it('usa a conexão da aplicação quando não há administrativa', () => {
    expect(urlAdministrativa({ DATABASE_URL: APP })).toBe(APP);
  });

  // O caso que derrubou o deploy: o `render.yaml` declara
  // `ADMIN_DATABASE_URL: ''` para reservar a variável, e `??` aceitava o vazio
  // como valor — o Prisma respondia "Connection url is empty" no migrate.
  it('trata variável administrativa vazia como ausente', () => {
    expect(urlAdministrativa({ ADMIN_DATABASE_URL: '', DATABASE_URL: APP })).toBe(APP);
    expect(urlAdministrativa({ ADMIN_DATABASE_URL: '   ', DATABASE_URL: APP })).toBe(APP);
  });

  it('devolve undefined quando nada está configurado', () => {
    expect(urlAdministrativa({ ADMIN_DATABASE_URL: '', DATABASE_URL: '' })).toBeUndefined();
    expect(urlAdministrativa({})).toBeUndefined();
  });

  it('aponta para o banco de testes quando PRISMA_USE_TEST_DB=1', () => {
    expect(
      urlAdministrativa({ PRISMA_USE_TEST_DB: '1', TEST_DATABASE_URL: TESTE, DATABASE_URL: APP }),
    ).toBe(TESTE);
  });

  it('não cai no banco da aplicação se o banco de testes faltar', () => {
    // Silêncio aqui rodaria as migrations de teste no banco de desenvolvimento.
    expect(urlAdministrativa({ PRISMA_USE_TEST_DB: '1', DATABASE_URL: APP })).toBeUndefined();
  });
});
