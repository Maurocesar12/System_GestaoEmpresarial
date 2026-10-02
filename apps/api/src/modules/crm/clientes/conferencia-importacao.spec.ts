import { conferirLinhasDeClientes } from './conferencia-importacao';

describe('conferirLinhasDeClientes', () => {
  it('aprova a linha boa e devolve os dados já normalizados', () => {
    const [linha] = conferirLinhasDeClientes([
      { nome: 'Ana Souza', email: 'ANA@EXEMPLO.COM', telefone: '', documento: '' },
    ]);

    expect(linha?.valida).toBe(true);
    expect(linha?.dados?.email).toBe('ana@exemplo.com');
    // Campo vazio vira `null`, como no cadastro manual.
    expect(linha?.dados?.telefone).toBeNull();
  });

  it('recusa a linha sem nome, com a mensagem do cadastro', () => {
    const [linha] = conferirLinhasDeClientes([{ nome: '', email: '' }]);

    expect(linha?.valida).toBe(false);
    expect(linha?.dados).toBeNull();
    expect(linha?.erros.length).toBeGreaterThan(0);
  });

  it('nomeia o campo quando o erro não é do nome', () => {
    const [linha] = conferirLinhasDeClientes([{ nome: 'Bruno', email: 'isso-nao-e-email' }]);

    expect(linha?.erros.some((erro) => erro.startsWith('email:'))).toBe(true);
  });

  it('mantém a posição de cada linha', () => {
    const resultado = conferirLinhasDeClientes([
      { nome: 'Ok' },
      { nome: '' },
      { nome: 'Também ok' },
    ]);

    expect(resultado.map((linha) => linha.valida)).toEqual([true, false, true]);
  });
});
