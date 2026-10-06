import 'server-only';
import type { DesafioDoisFatores } from '@gestao/shared-types';
import { redirect } from 'next/navigation';
import { gravarDesafio } from './sessao';

/**
 * Guarda o desafio do 2FA e leva para a etapa certa.
 *
 * Fica fora dos arquivos `'use server'` de propósito: lá, toda função
 * exportada vira uma ação que o navegador pode chamar com o argumento que
 * quiser. Aqui é só um passo interno das ações de entrar, cadastrar e aceitar
 * convite.
 */
export async function seguirParaDoisFatores(resposta: DesafioDoisFatores): Promise<never> {
  await gravarDesafio(resposta.desafio);
  redirect(resposta.configurar ? '/entrar/configurar-2fa' : '/entrar/verificacao');
}
