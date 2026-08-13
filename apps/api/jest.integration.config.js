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

  // Roda antes de qualquer módulo da aplicação ser importado. É onde o banco de
  // teste e os limites de rate limit são definidos.
  setupFiles: ['<rootDir>/test/setup-integration.js'],

  // Em série, não em paralelo: os testes compartilham o mesmo banco, e workers
  // concorrentes veriam os dados uns dos outros — justamente o que a suíte de
  // isolamento está tentando medir.
  maxWorkers: 1,

  // Conexão de banco e hash de senha com Argon2id demoram mais que teste
  // unitário; o padrão de 5s estoura com facilidade.
  testTimeout: 30_000,
};
