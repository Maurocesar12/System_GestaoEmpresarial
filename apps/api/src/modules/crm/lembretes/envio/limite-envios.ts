import type { TransacaoComTenant } from '../../../../infra/prisma/prisma.service';
import { TEMPO_MAXIMO_ENVIANDO_MS } from './envio.constantes';

/** Primeiro instante do mês corrente (UTC), o mesmo corte das previsões de IA. */
export function inicioDoMesAtual(agora = new Date()): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

/**
 * Quantos envios a empresa já usou no mês: o que saiu (`enviado`) e o que
 * está saindo agora (`enviando` recente). Contar o que está em voo é o que
 * impede dois jobs simultâneos de passarem juntos pelo último envio do mês.
 *
 * Não conta falha nem cancelamento: o que não chegou ao cliente não gasta a
 * cota. Roda dentro da transação do chamador, já no escopo da empresa (RLS).
 */
export function contarEnviosDoMes(
  tx: TransacaoComTenant,
  agora = new Date(),
  excetoLembreteId?: string,
): Promise<number> {
  const emVooDesde = new Date(agora.getTime() - TEMPO_MAXIMO_ENVIANDO_MS);

  return tx.lembreteFollowUp.count({
    where: {
      ...(excetoLembreteId ? { id: { not: excetoLembreteId } } : {}),
      OR: [
        { status: 'enviado', enviadoEm: { gte: inicioDoMesAtual(agora) } },
        { status: 'enviando', iniciadoEm: { gte: emVooDesde } },
      ],
    },
  });
}

export function mensagemLimiteEnvios(plano: string, limite: number): string {
  return (
    `Não enviado: o plano ${plano} permite ${limite} envio(s) por mês e o limite deste mês foi atingido. ` +
    'Faça upgrade do plano ou aguarde o próximo mês.'
  );
}
