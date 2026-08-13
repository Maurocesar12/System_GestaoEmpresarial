/**
 * Limites de requisição das rotas de autenticação (arquitetura §9.2).
 *
 * Ficam separados do controller por dois motivos.
 *
 * O primeiro é que são regra de segurança, não detalhe de rota: reuni-los aqui
 * deixa visível, num lugar só, o quanto o sistema tolera de tentativa de login.
 *
 * O segundo é prático. O decorator `@Throttle` é avaliado quando o módulo é
 * carregado, então o valor precisa existir nesse momento — daí a leitura direta
 * de `process.env`, e não do ConfigService, que só existe depois. Os testes de
 * integração fazem dezenas de logins seguidos e afogariam no limite real; eles
 * elevam estes números em `test/setup-integration.ts`.
 *
 * Os limites são por endereço IP, contados na memória do processo.
 */

function lerLimite(variavel: string, padrao: number): number {
  const valor = Number(process.env[variavel]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

const UM_MINUTO = 60_000;
const UMA_HORA = 3_600_000;

/**
 * Login: 5 por minuto.
 *
 * Suficiente para quem errou a senha e vai tentar de novo; inviável para quem
 * está testando uma lista de senhas vazadas.
 */
export const LIMITE_LOGIN = {
  default: { limit: lerLimite('AUTH_LIMITE_LOGIN', 5), ttl: UM_MINUTO },
};

/**
 * Renovação de sessão: 20 por minuto.
 *
 * Mais folgado que o login porque um usuário com várias abas abertas renova a
 * sessão legitimamente algumas vezes seguidas.
 */
export const LIMITE_REFRESH = {
  default: { limit: lerLimite('AUTH_LIMITE_REFRESH', 20), ttl: UM_MINUTO },
};

/**
 * Cadastro: 3 por hora.
 *
 * Criar empresa é algo que uma pessoa faz uma vez. Repetição em rajada do mesmo
 * IP é robô abrindo contas.
 */
export const LIMITE_CADASTRO = {
  default: { limit: lerLimite('AUTH_LIMITE_CADASTRO', 3), ttl: UMA_HORA },
};
