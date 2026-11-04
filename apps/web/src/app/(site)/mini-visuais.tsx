import { ArrowRight, Check, Clock, Mail, PackageMinus } from 'lucide-react';
import type { ReactNode } from 'react';
import { CONTA_DO_EXEMPLO, reais, resumirMes, type VisualRecurso } from './conteudo';

/**
 * A miniatura de cada recurso: um pedaço da tela do produto, não um ícone.
 *
 * São composições pequenas, em código, com os mesmos dados de exemplo do resto
 * da página. Decorativas (`aria-hidden`): o título e a descrição do cartão
 * dizem em texto o que a miniatura mostra.
 */
export function MiniVisual({ tipo }: { tipo: VisualRecurso }) {
  return (
    <div
      aria-hidden
      className="flex h-36 items-center justify-center overflow-hidden rounded-xl border bg-(--papel) p-4"
    >
      {VISUAIS[tipo]()}
    </div>
  );
}

const VISUAIS: Record<VisualRecurso, () => ReactNode> = {
  clientes: () => (
    <div className="bg-card w-full max-w-[15rem] rounded-lg border p-3 shadow-(--sombra-sutil)">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-(--acento-suave) text-[0.65rem] font-semibold text-(--acento)">
          MS
        </span>
        <div>
          <p className="text-xs font-semibold">Maria Souza</p>
          <p className="text-muted-foreground text-[0.65rem]">Cliente desde março</p>
        </div>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5 border-t pt-2.5 text-[0.65rem]">
        <LinhaHistorico data="12/11" texto="Instalação de ar-condicionado" />
        <LinhaHistorico data="03/06" texto="Higienização" />
        <LinhaHistorico data="18/03" texto="Orçamento aprovado" />
      </ul>
    </div>
  ),

  negociacoes: () => (
    <div className="grid w-full max-w-[16rem] grid-cols-3 gap-2">
      {[
        { coluna: 'Novo', cartoes: 2 },
        { coluna: 'Orçamento', cartoes: 2, parado: true },
        { coluna: 'Fechado', cartoes: 1, fechado: true },
      ].map((coluna) => (
        <div key={coluna.coluna} className="flex flex-col gap-1.5">
          <p
            className={`text-[0.6rem] font-semibold ${coluna.fechado ? 'text-(--acento)' : 'text-muted-foreground'}`}
          >
            {coluna.coluna}
          </p>
          {Array.from({ length: coluna.cartoes }, (_, i) => (
            <span
              key={i}
              className={`bg-card flex h-7 items-center rounded-md border px-1.5 shadow-(--sombra-sutil) ${coluna.parado && i === 1 ? 'border-(--atencao)/60' : ''}`}
            >
              {coluna.parado && i === 1 ? (
                <Clock className="text-atencao size-3" />
              ) : (
                <span className="h-1 w-3/4 rounded-full bg-(--linha-forte)" />
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),

  orcamentos: () => (
    <div className="flex w-full max-w-[16rem] items-center justify-between gap-2">
      <div className="bg-card rounded-lg border p-2.5 shadow-(--sombra-sutil)">
        <p className="text-muted-foreground text-[0.6rem]">Orçamento</p>
        <p className="numerico text-xs font-semibold">{reais(CONTA_DO_EXEMPLO.receita)}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-(--acento-suave) px-1.5 py-0.5 text-[0.6rem] font-medium text-(--acento)">
          <Check className="size-2.5" /> Aprovado
        </span>
      </div>
      <ArrowRight className="size-4 shrink-0 text-(--acento)" />
      <div className="rounded-lg border border-(--acento)/35 bg-(--acento-suave) p-2.5">
        <p className="text-[0.6rem] font-semibold text-(--acento)">Fechado</p>
        <p className="text-xs font-semibold">Maria Souza</p>
      </div>
    </div>
  ),

  execucao: () => (
    <div className="bg-card w-full max-w-[15rem] rounded-lg border p-3 shadow-(--sombra-sutil)">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">09:00 · Instalação</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-(--acento) px-2 py-0.5 text-[0.6rem] font-semibold text-(--acento-texto)">
          <Check className="size-2.5" /> Executado
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5 border-t pt-2.5 text-[0.65rem]">
        <p className="text-muted-foreground flex items-center gap-1.5">
          <PackageMinus className="size-3" /> Material baixado do estoque
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5">
          <Check className="size-3 text-(--acento)" /> Registrado no histórico
        </p>
      </div>
    </div>
  ),

  retorno: () => (
    <div className="flex w-full max-w-[15rem] items-center gap-3">
      <div className="bg-card flex w-14 shrink-0 flex-col items-center rounded-lg border shadow-(--sombra-sutil)">
        <span className="w-full rounded-t-lg bg-(--acento) py-0.5 text-center text-[0.55rem] font-semibold text-(--acento-texto) uppercase">
          nov
        </span>
        <span className="numero-destaque py-1 text-xl">20</span>
      </div>
      <div className="bg-card min-w-0 flex-1 rounded-lg border p-2.5 shadow-(--sombra-sutil)">
        <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold">
          <Mail className="size-3 text-(--acento)" /> Lembrete enviado
        </p>
        <p className="text-muted-foreground mt-1 truncate text-[0.6rem]">Para: Carlos Lima</p>
      </div>
    </div>
  ),

  margem: () => {
    const { servicos } = resumirMes();

    return (
      <div className="flex h-full w-full max-w-[15rem] items-end justify-between gap-3">
        {servicos.map((servico) => (
          <div
            key={servico.nome}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="numerico text-[0.65rem] font-semibold">{servico.margem}%</span>
            {/* A altura é a margem: a barra mais alta é o serviço que mais sobra. */}
            <span
              className="w-full rounded-t-md bg-(--acento)"
              style={{ height: `${servico.margem * 0.7}%`, opacity: 0.45 + servico.margem / 180 }}
            />
            <span className="text-muted-foreground w-full truncate text-center text-[0.55rem]">
              {servico.nome.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    );
  },
};

function LinhaHistorico({ data, texto }: { data: string; texto: string }) {
  return (
    <li className="flex gap-2">
      <span className="numerico text-muted-foreground shrink-0">{data}</span>
      <span className="truncate">{texto}</span>
    </li>
  );
}
