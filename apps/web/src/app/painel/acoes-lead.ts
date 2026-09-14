'use server';

import { revalidatePath } from 'next/cache';
import { clienteFormSchema, type Cliente } from '@gestao/shared-types';
import { primeiroErro, traduzirErroAcao, type ResultadoAcao } from '@/lib/acoes';
import { apiComSessao } from '@/lib/api-servidor';

/**
 * Registra um lead que acabou de chegar, direto do cartão do painel.
 *
 * ## Por que existe, se já há a tela de novo cliente
 *
 * São momentos diferentes. A tela de cadastro serve para preencher a ficha de
 * alguém que virou cliente; este atalho serve para o telefone que **está
 * tocando agora**. Mandar quem atende sair do painel, abrir outra tela e
 * preencher um formulário completo é o caminho mais curto para o lead virar um
 * papel na mesa — e sumir.
 *
 * Por isso só o nome é exigido. Telefone, e-mail e origem entram se a pessoa
 * tiver, e o resto do cadastro fica para depois, na ficha do cliente.
 */
export async function adicionarLead(dados: {
  nome: string;
  telefone: string;
  email: string;
  origem: string;
}): Promise<ResultadoAcao> {
  // O mesmo schema do cadastro completo: é ele que normaliza telefone e
  // e-mail e converte campo vazio em `null`. Validar aqui, e não só no
  // navegador, é o que vale — a tela é conveniência para quem digita.
  const validacao = clienteFormSchema.safeParse({
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    documento: '',
    observacoes: '',
    origem: dados.origem,
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    camposPersonalizados: {},
    etiquetas: [],
  });

  // Uma mensagem, e não o mapa de erros por campo: o formulário do cartão tem
  // uma linha para avisos, e "confira os dados" sem dizer qual deixaria a
  // pessoa procurando.
  if (!validacao.success) {
    return primeiroErro(validacao.error.issues);
  }

  try {
    await apiComSessao<Cliente>('/clientes', {
      method: 'POST',
      body: JSON.stringify(validacao.data),
    });
  } catch (erro) {
    // O limite de clientes do plano volta como 403 com a mensagem explicando
    // quantas vagas restam; vale mais que um genérico.
    return traduzirErroAcao(erro, 'Não foi possível registrar o lead. Tente novamente.');
  }

  // O cartão de leads é a própria tela: sem revalidar, o lead recém-criado não
  // apareceria na lista que está logo abaixo do formulário.
  revalidatePath('/painel');
  return {};
}
