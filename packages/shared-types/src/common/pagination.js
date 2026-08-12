'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.paginacaoQuerySchema = void 0;
const zod_1 = require('zod');
/** Query string de paginação aceita por toda listagem da API. */
exports.paginacaoQuerySchema = zod_1.z.object({
  pagina: zod_1.z.coerce.number().int().positive().default(1),
  porPagina: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=pagination.js.map
