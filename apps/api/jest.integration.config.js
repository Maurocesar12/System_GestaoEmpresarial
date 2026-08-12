/**
 * Testes de integração — precisam de um PostgreSQL no ar.
 *
 * Rode com: pnpm --filter @gestao/api test:db
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',

  // Em série, não em paralelo: os testes de isolamento compartilham o mesmo
  // banco, e workers concorrentes veriam os dados uns dos outros — justamente
  // o que estamos tentando medir.
  maxWorkers: 1,

  // Conexão de banco demora mais que teste unitário; o padrão de 5s estoura
  // com facilidade na primeira conexão.
  testTimeout: 30_000,
};
