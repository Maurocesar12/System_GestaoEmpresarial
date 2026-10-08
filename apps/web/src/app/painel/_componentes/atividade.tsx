import Link from 'next/link';
import { Activity } from 'lucide-react';
import { type PainelTempoReal } from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import {
  Cartao,
  CartaoCabecalho,
  CartaoItem,
  CartaoLista,
  CartaoTitulo,
} from '@/components/ui/cartao';
import { formatarQuando } from '@/lib/formatacao';

/** Atividade recente e o guia de primeiros passos do painel. */

/**
 * O que acabou de acontecer.
 *
 * Sai do histórico de auditoria, filtrado pela API para mostrar só os eventos
 * das entidades que a pessoa poderia abrir. É o bloco que faz o painel parecer
 * vivo numa empresa com mais de uma pessoa trabalhando.
 */
export function Atividade({ eventos }: { eventos: PainelTempoReal['atividade'] }) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <Activity aria-hidden className="text-muted-foreground size-4" />
          Acabou de acontecer
        </CartaoTitulo>
        <span className="text-muted-foreground text-xs">últimos registros</span>
      </CartaoCabecalho>

      <CartaoLista>
        {eventos.map((evento) => (
          <CartaoItem key={evento.id}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{evento.resumo}</span>
              <span className="text-muted-foreground text-xs">{evento.usuarioNome}</span>
            </div>

            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatarQuando(evento.quando)}
            </span>
          </CartaoItem>
        ))}
      </CartaoLista>
    </Cartao>
  );
}

/**
 * Tela de empresa recém-criada.
 *
 * Números zerados não ajudam quem acabou de entrar. Uma sequência clara do que
 * fazer primeiro transforma a tela vazia em ponto de partida.
 */
export function PrimeirosPassos() {
  const passos = [
    {
      titulo: 'Cadastre seus serviços',
      descricao: 'Com o custo de cada um, para o sistema calcular sua margem depois.',
      href: '/painel/servicos/novo',
      rotulo: 'Novo serviço',
    },
    {
      titulo: 'Cadastre um cliente',
      descricao: 'Nome e telefone já bastam para começar. Ele aparece na fila de leads.',
      href: '/painel/clientes/novo',
      rotulo: 'Novo cliente',
    },
    {
      titulo: 'Emita um orçamento',
      descricao: 'O cliente entra no funil sozinho quando você emite a proposta.',
      href: '/painel/orcamentos/novo',
      rotulo: 'Novo orçamento',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Bem-vindo"
        descricao="Sua empresa está criada e o funil já vem configurado. Três passos para começar:"
      />

      <ol className="flex flex-col gap-3">
        {passos.map((passo, indice) => (
          <li key={passo.href}>
            <Cartao className="flex flex-wrap items-center gap-4 p-4">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                {indice + 1}
              </span>

              <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
                <p className="font-medium">{passo.titulo}</p>
                <p className="text-muted-foreground text-sm">{passo.descricao}</p>
              </div>

              <Link href={passo.href} className={estilosBotao({ variante: 'secundario' })}>
                {passo.rotulo}
              </Link>
            </Cartao>
          </li>
        ))}
      </ol>
    </div>
  );
}
