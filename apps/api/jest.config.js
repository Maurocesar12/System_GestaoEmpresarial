/**
 * Testes unitários — rodam sem banco, em qualquer máquina, em segundos.
 *
 * Os testes de integração (`*.int-spec.ts`) ficam de fora daqui de propósito:
 * eles precisam de um PostgreSQL no ar e vivem em `jest.integration.config.js`.
 * Misturar os dois faria a suíte rápida falhar em quem ainda não montou o banco.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '\\.int-spec\\.ts$'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/generated/**',
  ],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};
