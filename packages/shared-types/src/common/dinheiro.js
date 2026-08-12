'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.dinheiroSchema = void 0;
exports.formatarBRL = formatarBRL;
const zod_1 = require('zod');
/**
 * Valor monetário.
 *
 * O banco guarda em NUMERIC/DECIMAL (arquitetura §7 — nunca FLOAT). Para não
 * jogar fora essa precisão no transporte, dinheiro trafega em JSON como
 * **string decimal** ("1234.56"), nunca como `number`: `JSON.parse` devolve
 * float de 64 bits e o erro de arredondamento se acumula no fluxo de caixa.
 *
 * Formatação para exibição é responsabilidade do frontend (Intl.NumberFormat).
 * Aritmética deve acontecer no banco ou com biblioteca decimal.
 */
exports.dinheiroSchema = zod_1.z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Valor monetário inválido — use o formato "1234.56"');
/** Formata um valor monetário para exibição em pt-BR (R$ 1.234,56). */
function formatarBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor));
}
//# sourceMappingURL=dinheiro.js.map
