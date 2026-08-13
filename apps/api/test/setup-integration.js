// @ts-check
require('dotenv/config');

/**
 * Preparação do ambiente dos testes de integração.
 *
 * Roda **antes** de qualquer módulo da aplicação ser carregado — é o que o
 * `setupFiles` do Jest garante. Isso importa porque os limites de rate limit
 * são lidos no momento em que o decorator `@Throttle` é avaliado, ou seja, no
 * import do controller. Definir as variáveis dentro de um `beforeAll` seria
 * tarde demais.
 *
 * Em JavaScript, e não TypeScript, de propósito: o `tsconfig` da API tem
 * `rootDir` em `src/`, então um `.ts` aqui fora ficaria fora do projeto e o
 * ts-jest não conseguiria transformá-lo. Como o arquivo só atribui variáveis de
 * ambiente, não há o que tipar.
 */

// Aponta para o banco de teste. Os testes criam e apagam dados o tempo todo, e
// não podem competir com o que você está usando no navegador.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Limites altos aqui, não desligados: a suíte faz dezenas de chamadas seguidas
// do mesmo IP e afogaria nos limites reais. Desligar o guard por completo
// esconderia um erro de configuração dele; elevar o teto mantém o caminho de
// código exercitado. O comportamento do limite real é testado à parte, com
// valores próprios.
process.env.AUTH_LIMITE_LOGIN = '1000';
process.env.AUTH_LIMITE_REFRESH = '1000';
process.env.AUTH_LIMITE_CADASTRO = '1000';
process.env.THROTTLE_LIMIT = '10000';

// Segredo previsível e exclusivo do ambiente de teste. Nunca vale em produção,
// onde o valor vem das variáveis do Render.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'segredo-exclusivo-de-teste-com-mais-de-32-caracteres';
