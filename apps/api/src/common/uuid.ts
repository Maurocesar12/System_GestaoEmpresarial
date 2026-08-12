import { randomBytes } from 'node:crypto';

/**
 * Gera um UUID versão 7 (RFC 9562).
 *
 * O v7 começa com o instante de criação em milissegundos, então os
 * identificadores nascem em ordem cronológica. Isso importa para a chave
 * primária: o índice cresce sempre pela ponta, em vez de sofrer inserções no
 * meio a cada registro novo, como acontece com o v4 aleatório.
 *
 * O layout dos 128 bits:
 *
 *   ┌────────────────────────┬─────┬──────────┬─────┬───────────────────────┐
 *   │ timestamp em ms        │ ver │ aleatório│ var │ aleatório             │
 *   │ 48 bits                │ 4   │ 12       │ 2   │ 62                    │
 *   └────────────────────────┴─────┴──────────┴─────┴───────────────────────┘
 *
 * Escrito à mão em vez de usar a biblioteca `uuid` porque a versão atual dela é
 * ESM puro, e o Jest deste projeto roda em CommonJS — trazê-la exigiria
 * configuração de transformação para uma função de quinze linhas.
 */
export function uuidv7(): string {
  const bytes = randomBytes(16);

  // Os 48 bits do timestamp ocupam os 6 primeiros bytes, big-endian.
  // `Date.now()` só ultrapassaria 48 bits no ano 10889.
  bytes.writeUIntBE(Date.now(), 0, 6);

  // Versão 7 nos 4 bits altos do byte 6, preservando os 4 bits aleatórios.
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);

  // Variante RFC nos 2 bits altos do byte 8, preservando os 6 aleatórios.
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
