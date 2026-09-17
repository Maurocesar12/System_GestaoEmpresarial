import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CODIGOS_ERRO } from '@gestao/shared-types';
import type { TransacaoComTenant } from '../infra/prisma/prisma.service';

/**
 * Confere que os registros apontados por um formulário existem nesta empresa.
 *
 * A RLS já impede atravessar empresas, mas sem esta checagem um id inexistente
 * viraria erro de chave estrangeira do Postgres — que não diz nada a quem está
 * preenchendo o formulário.
 *
 * As consultas vão juntas: são independentes, e encadeá-las custaria uma ida ao
 * banco a mais em toda criação de orçamento, agendamento e lançamento.
 *
 * Recebe a transação em vez de abrir a sua: quem chama já está dentro de um
 * `comTenant`, e abrir outra transação para conferir um id desfaria a
 * atomicidade da operação inteira.
 *
 * Cada vínculo é opcional — o campo ausente simplesmente não é conferido. Isso
 * é o que permite os três módulos usarem a mesma função: orçamento e
 * agendamento exigem cliente, lançamento financeiro aceita os três em branco.
 */
export async function garantirVinculos(
  tx: TransacaoComTenant,
  vinculos: {
    clienteId?: string | null;
    servicoId?: string | null;
    categoriaId?: string | null;
    /** Vendedor ou técnico: precisa ser alguém ativo da equipe. */
    vendedorId?: string | null;
    tecnicoId?: string | null;
    orcamentoId?: string | null;
  },
): Promise<void> {
  const pessoas = [vinculos.vendedorId, vinculos.tecnicoId].filter(
    (id): id is string => typeof id === 'string',
  );

  const [cliente, servico, categoria, ativos, orcamento] = await Promise.all([
    vinculos.clienteId
      ? tx.cliente.findUnique({ where: { id: vinculos.clienteId }, select: { id: true } })
      : null,
    vinculos.servicoId
      ? tx.servico.findUnique({ where: { id: vinculos.servicoId }, select: { id: true } })
      : null,
    vinculos.categoriaId
      ? tx.categoriaFinanceira.findUnique({
          where: { id: vinculos.categoriaId },
          select: { id: true },
        })
      : null,
    pessoas.length
      ? tx.usuario.count({ where: { id: { in: [...new Set(pessoas)] }, ativo: true } })
      : 0,
    vinculos.orcamentoId
      ? tx.orcamento.findUnique({
          where: { id: vinculos.orcamentoId },
          select: { clienteId: true },
        })
      : null,
  ]);

  if (vinculos.clienteId && !cliente) {
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

  if (vinculos.categoriaId && !categoria) {
    throw new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Categoria não encontrada.',
    });
  }

  if (ativos !== new Set(pessoas).size) {
    throw new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Pessoa da equipe não encontrada ou desativada.',
    });
  }

  if (vinculos.orcamentoId && !orcamento) {
    throw new NotFoundException({
      codigo: CODIGOS_ERRO.NAO_ENCONTRADO,
      mensagem: 'Orçamento não encontrado.',
    });
  }

  // O orçamento é a base da comissão de execução: ligar o de outro cliente
  // pagaria comissão sobre um valor que não tem nada a ver com este serviço.
  if (orcamento && vinculos.clienteId && orcamento.clienteId !== vinculos.clienteId) {
    throw new BadRequestException({
      codigo: CODIGOS_ERRO.VALIDACAO,
      mensagem: 'O orçamento escolhido é de outro cliente.',
    });
  }
}
