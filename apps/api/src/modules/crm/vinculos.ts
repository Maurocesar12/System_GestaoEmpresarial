import { NotFoundException } from '@nestjs/common';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import type { TransacaoComTenant } from '../../infra/prisma/prisma.service';

/**
 * Confere que cliente e serviço existem nesta empresa.
 *
 * A RLS já impede atravessar empresas, mas sem esta checagem um id inexistente
 * viraria erro de chave estrangeira do Postgres — que não diz nada a quem está
 * preenchendo o formulário.
 *
 * As duas consultas vão juntas: são independentes, e encadeá-las custaria uma
 * ida ao banco a mais em toda criação de orçamento e de agendamento.
 *
 * Recebe a transação em vez de abrir a sua: quem chama já está dentro de um
 * `comTenant`, e abrir outra transação para conferir um id desfaria a
 * atomicidade da operação inteira.
 */
export async function garantirClienteEServico(
  tx: TransacaoComTenant,
  vinculos: { clienteId: string; servicoId?: string | null },
): Promise<void> {
  const [cliente, servico] = await Promise.all([
    tx.cliente.findUnique({ where: { id: vinculos.clienteId }, select: { id: true } }),
    vinculos.servicoId
      ? tx.servico.findUnique({ where: { id: vinculos.servicoId }, select: { id: true } })
      : null,
  ]);

  if (!cliente) {
    throw new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Cliente não encontrado.',
    });
  }

  if (vinculos.servicoId && !servico) {
    throw new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Serviço não encontrado.',
    });
  }
}
