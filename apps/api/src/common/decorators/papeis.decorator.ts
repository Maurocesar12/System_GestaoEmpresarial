import { SetMetadata } from '@nestjs/common';
import type { PapelUsuario } from '@gestao/shared-types';

export const CHAVE_PAPEIS = 'papeis_permitidos';

/**
 * Restringe uma rota a determinados papéis (arquitetura §9.5).
 *
 * Sem o decorator, qualquer usuário autenticado do tenant acessa. Com ele, só
 * os papéis listados.
 *
 * A regra do documento de arquitetura:
 * - Financeiro (pró-labore, reserva, margem, fluxo de caixa): `admin` e `financeiro`
 * - CRM (clientes, funil, orçamento, agendamento): `admin`, `atendente` e `tecnico`
 *
 * @example
 * ```ts
 * @Papeis('admin', 'financeiro')
 * @Get('fluxo-de-caixa')
 * fluxoDeCaixa() {}
 * ```
 */
export const Papeis = (...papeis: PapelUsuario[]) => SetMetadata(CHAVE_PAPEIS, papeis);
