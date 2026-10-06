'use server';

import type { AceitarConviteInput, DesafioDoisFatores } from '@gestao/shared-types';
import { traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiFetch } from '@/lib/api';
import { seguirParaDoisFatores } from '@/lib/dois-fatores';

export async function aceitarConvite(dados: AceitarConviteInput): Promise<ResultadoAcao> {
  let resposta: DesafioDoisFatores;
  try {
    resposta = await apiFetch<DesafioDoisFatores>('/equipe/convites/aceitar', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  } catch (erro) {
    return traduzirErroAcao(erro, 'Não foi possível aceitar o convite.');
  }
  // Quem entra pelo convite configura o app autenticador antes do painel.
  return seguirParaDoisFatores(resposta);
}
