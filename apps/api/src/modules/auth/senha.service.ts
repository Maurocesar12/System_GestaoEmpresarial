import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Guarda e confere senhas.
 *
 * Usa **Argon2id**, a recomendação atual da OWASP para projetos novos
 * (arquitetura §9.1). Diferente de SHA-256 ou MD5, que foram feitos para ser
 * rápidos, o Argon2id é propositalmente lento e consome memória — é isso que
 * torna caro testar bilhões de senhas por segundo caso o banco vaze.
 *
 * ## Sobre o custo de CPU
 *
 * Este é o ponto mais caro de toda a autenticação: cada verificação leva
 * dezenas de milissegundos e reserva ~19 MB de memória. E precisa ser assim —
 * um hash rápido aqui é uma falha de segurança, não uma otimização.
 *
 * O que mantém o custo sob controle não é enfraquecer o algoritmo, e sim
 * chamá-lo raramente:
 *
 * - Só o **login** e o **cadastro** passam por aqui. Depois disso, quem
 *   autentica cada requisição é o JWT, que custa microssegundos.
 * - O access token dura 15 minutos e é renovado pelo refresh token, que
 *   também não toca em senha. Uma sessão de oito horas faz **uma** verificação
 *   Argon2, não centenas.
 * - O rate limit de 5 tentativas por minuto no login (§9.2) impede que alguém
 *   force o servidor a gastar CPU em sequência.
 */
@Injectable()
export class SenhaService {
  /**
   * Parâmetros de custo, nos valores sugeridos pela OWASP: 19 MiB de memória,
   * 2 iterações, 1 thread.
   *
   * A OWASP considera equivalentes várias combinações — 46 MiB com 1 iteração,
   * 12 MiB com 3, 9 MiB com 4. Todas custam aproximadamente o mesmo tempo; o
   * que muda é o balanço entre memória e CPU. Se a hospedagem for apertada de
   * RAM, `memoryCost: 12288` com `timeCost: 3` é a troca a fazer, sem perder
   * segurança.
   *
   * Alterar estes números depois não invalida os hashes já gravados: o Argon2
   * guarda os parâmetros dentro do próprio hash, e cada um é verificado com os
   * que foram usados para criá-lo.
   *
   * `raw: false` explícito porque `argon2.hash` tem duas assinaturas: com
   * `raw: true` devolve Buffer, sem ele devolve a string codificada que
   * queremos gravar no banco.
   */
  private readonly opcoes: argon2.HashOptions & { raw?: false } = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    raw: false,
  };

  /**
   * Hash descartável usado para igualar o tempo de resposta quando o e-mail não
   * existe. Calculado uma vez e reaproveitado — recalculá-lo a cada tentativa
   * seria desperdício, já que o valor não importa, só o custo de verificá-lo.
   */
  private hashDescartavel?: string;

  /** Gera o hash para gravar no banco. O salt é aleatório e vai dentro dele. */
  async gerarHash(senha: string): Promise<string> {
    return argon2.hash(senha, this.opcoes);
  }

  /**
   * Confere a senha contra o hash gravado.
   *
   * Nunca lança quando a senha está errada — devolve `false`. Um hash
   * corrompido ou em formato desconhecido também vira `false`, para que uma
   * linha estragada no banco não derrube o login com erro 500.
   */
  async conferir(hash: string, senha: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, senha);
    } catch {
      return false;
    }
  }

  /**
   * Consome o mesmo tempo de uma conferência real, sem ter o que conferir.
   *
   * Serve para o caso do e-mail que não existe. Sem isso, a resposta voltaria
   * quase instantaneamente, enquanto um e-mail cadastrado levaria o tempo do
   * Argon2 — e essa diferença permitiria descobrir quais e-mails têm conta no
   * sistema, uma requisição por vez.
   *
   * Usa `verify` contra um hash fixo, e não `hash`, por dois motivos: é
   * exatamente a mesma operação do caminho real (mesma duração, sem gerar salt
   * novo à toa) e reaproveita o hash já calculado.
   */
  async simularConferencia(): Promise<void> {
    this.hashDescartavel ??= await argon2.hash('valor-irrelevante', this.opcoes);

    await argon2.verify(this.hashDescartavel, 'senha-que-nao-confere');
  }
}
