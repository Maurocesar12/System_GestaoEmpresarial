import { uuidv7 } from './uuid';

describe('uuidv7', () => {
  it('tem o formato canônico de UUID', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('marca a versão 7 e a variante RFC', () => {
    // Sem estes dois campos o PostgreSQL ainda aceitaria o valor na coluna
    // `uuid`, mas ele não seria um UUID v7 de verdade — e nada avisaria.
    const uuid = uuidv7();

    expect(uuid[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
  });

  it('gera identificadores crescentes ao longo do tempo', () => {
    // A ordenação é a razão de existir do v7: é ela que evita fragmentar o
    // índice da chave primária a cada inserção.
    const antes = uuidv7();

    jest.useFakeTimers().setSystemTime(Date.now() + 1_000);
    const depois = uuidv7();
    jest.useRealTimers();

    expect(depois > antes).toBe(true);
  });

  it('não repete valores gerados no mesmo milissegundo', () => {
    const gerados = new Set(Array.from({ length: 1_000 }, () => uuidv7()));

    expect(gerados.size).toBe(1_000);
  });
});
