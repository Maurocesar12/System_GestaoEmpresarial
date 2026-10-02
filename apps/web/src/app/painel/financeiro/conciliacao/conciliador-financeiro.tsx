'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Landmark,
  Link2,
  ReceiptText,
  Upload,
} from 'lucide-react';
import { useMemo, useState, useTransition, type ChangeEvent } from 'react';
import { EXTENSOES_ACEITAS, ErroDePlanilha, lerPlanilha } from '@/lib/planilha';
import { formatarDataCurta } from '@/lib/formatacao';
import { cn } from '@/lib/utils';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  ROTULO_TIPO_LANCAMENTO,
  formatarBRL,
  type MovimentacaoConciliavel,
} from '@gestao/shared-types';
import { darBaixa } from '../acoes';
import { analisarExtrato } from './acoes';

type Movimentacao = MovimentacaoConciliavel & { status: 'pendente' | 'conciliado' };

/**
 * Conciliação bancária.
 *
 * A tela só lê o arquivo do banco e manda as células para a API, que acha as
 * colunas, entende datas e valores, busca as contas em aberto e sugere o
 * vínculo de cada linha — com a diferença de valor já calculada. Conciliar é
 * dar baixa na conta escolhida, pela rota de baixa de sempre.
 */
export function ConciliadorFinanceiro() {
  const [falha, setFalha] = useState<string>();
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [contasEmAberto, setContasEmAberto] = useState(0);
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [contasConciliadas, setContasConciliadas] = useState<Set<string>>(() => new Set());
  const [lendo, setLendo] = useState(false);
  const [processando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  /** A opção escolhida para cada movimentação, com a diferença que a API calculou. */
  const opcaoEscolhida = (movimentacao: Movimentacao) =>
    movimentacao.opcoes.find((opcao) => opcao.contaId === selecionados[movimentacao.id]);

  // Contagens do que está na tela; os números de dinheiro vêm todos da API.
  const resumo = useMemo(() => {
    const conciliadas = movimentacoes.filter((item) => item.status === 'conciliado').length;

    return {
      importadas: movimentacoes.length,
      sugeridas: movimentacoes.filter((item) => item.status === 'pendente' && selecionados[item.id])
        .length,
      pendentes: movimentacoes.length - conciliadas,
      divergencias: movimentacoes.filter((item) => {
        const opcao = item.opcoes.find((candidata) => candidata.contaId === selecionados[item.id]);
        return opcao ? Number(opcao.diferenca) !== 0 : false;
      }).length,
    };
  }, [movimentacoes, selecionados]);

  const importarExtrato = async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    setFalha(undefined);

    if (!arquivo) {
      return;
    }

    setLendo(true);

    try {
      const planilha = await lerPlanilha(arquivo);
      const resposta = await analisarExtrato({
        cabecalhos: planilha.cabecalhos,
        linhas: planilha.linhas,
      });

      if (resposta.erro || !resposta.analise) {
        setFalha(resposta.erro ?? 'Não foi possível analisar o extrato.');
        return;
      }

      const { analise } = resposta;
      setMovimentacoes(analise.movimentacoes.map((item) => ({ ...item, status: 'pendente' })));
      setContasEmAberto(analise.contasEmAberto);
      setContasConciliadas(new Set());
      setSelecionados(
        Object.fromEntries(
          analise.movimentacoes.flatMap((item) =>
            item.contaSugeridaId ? [[item.id, item.contaSugeridaId]] : [],
          ),
        ),
      );

      avisar(
        'sucesso',
        analise.ignoradas > 0
          ? `${analise.movimentacoes.length} movimentação(s) importada(s); ${analise.ignoradas} linha(s) sem data, descrição ou valor ficaram de fora.`
          : `${analise.movimentacoes.length} movimentação(s) importada(s).`,
      );
    } catch (erro) {
      setFalha(
        erro instanceof ErroDePlanilha || erro instanceof Error
          ? erro.message
          : 'Não foi possível ler o extrato.',
      );
    } finally {
      setLendo(false);
    }
  };

  const conciliar = (movimentacao: Movimentacao) => {
    const contaId = selecionados[movimentacao.id];

    if (!contaId) {
      avisar('atencao', 'Escolha uma conta para vincular antes de conciliar.');
      return;
    }

    iniciar(async () => {
      const resultado = await darBaixa(contaId, movimentacao.data);

      if (resultado.erro) {
        avisar('erro', resultado.erro);
        return;
      }

      setMovimentacoes((atuais) =>
        atuais.map((item) =>
          item.id === movimentacao.id ? { ...item, status: 'conciliado' } : item,
        ),
      );
      setContasConciliadas((atuais) => new Set(atuais).add(contaId));
      avisar('sucesso', 'Movimentação conciliada.');
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 md:grid-cols-4">
        <IndicadorConciliacao titulo="Importadas" valor={resumo.importadas} />
        <IndicadorConciliacao titulo="Sugeridas" valor={resumo.sugeridas} />
        <IndicadorConciliacao titulo="Pendências" valor={resumo.pendentes} />
        <IndicadorConciliacao titulo="Diferenças" valor={resumo.divergencias} alerta />
      </section>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2">
            <FileSpreadsheet aria-hidden className="text-muted-foreground size-4" />
            Importação de extrato bancário
          </CartaoTitulo>
          <span className="text-muted-foreground text-xs">
            Aceita {EXTENSOES_ACEITAS.join(', ')}
          </span>
        </CartaoCabecalho>

        <CartaoConteudo className="flex flex-col gap-4">
          {falha && <AvisoErro mensagem={falha} />}

          <label className="hover:bg-accent/40 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed px-4 py-5 transition-colors">
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-muted">
                <Upload aria-hidden className="size-4 text-muted-foreground" />
              </span>
              <span>
                <span className="block text-sm font-medium">
                  {lendo ? 'Analisando o extrato…' : 'Selecionar extrato'}
                </span>
                <span className="text-muted-foreground block text-xs">
                  Use uma planilha com colunas de data, descrição e valor.
                </span>
              </span>
            </span>
            <input
              type="file"
              accept={EXTENSOES_ACEITAS.join(',')}
              className="sr-only"
              disabled={lendo}
              onChange={importarExtrato}
            />
          </label>
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2">
            <Link2 aria-hidden className="text-muted-foreground size-4" />
            Vincular movimentações a contas
          </CartaoTitulo>
          {movimentacoes.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {contasEmAberto - contasConciliadas.size} conta(s) em aberto.
            </p>
          )}
        </CartaoCabecalho>

        {movimentacoes.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={Landmark}
              titulo="Nenhum extrato importado"
              descricao="Importe o arquivo do banco para conferir pagamentos, recebimentos, diferenças e pendências."
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <div className="divide-y">
            {movimentacoes.map((movimentacao) => {
              const opcao = opcaoEscolhida(movimentacao);
              const bate = opcao ? Number(opcao.diferenca) === 0 : null;

              return (
                <article
                  key={movimentacao.id}
                  className="grid gap-4 p-4 lg:grid-cols-[1fr_1.3fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          movimentacao.tipo === 'entrada'
                            ? 'bg-sucesso-suave text-sucesso'
                            : 'bg-destrutivo-suave text-destructive',
                        )}
                      >
                        {ROTULO_TIPO_LANCAMENTO[movimentacao.tipo]}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatarDataCurta(movimentacao.data)}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-sm font-medium">{movimentacao.descricao}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatarBRL(movimentacao.valor)}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor={`conta-${movimentacao.id}`}>
                      Conta vinculada
                    </label>
                    <select
                      id={`conta-${movimentacao.id}`}
                      value={selecionados[movimentacao.id] ?? ''}
                      disabled={movimentacao.status === 'conciliado'}
                      onChange={(evento) =>
                        setSelecionados((atuais) => ({
                          ...atuais,
                          [movimentacao.id]: evento.target.value,
                        }))
                      }
                      className="h-10 rounded-md border bg-card px-3 text-sm"
                    >
                      <option value="">Escolha uma conta</option>
                      {/* As mais prováveis primeiro, na ordem da API. Uma conta
                          já conciliada nesta sessão não é oferecida de novo. */}
                      {movimentacao.opcoes
                        .filter(
                          (candidata) =>
                            !contasConciliadas.has(candidata.contaId) ||
                            candidata.contaId === selecionados[movimentacao.id],
                        )
                        .map((candidata) => (
                          <option key={candidata.contaId} value={candidata.contaId}>
                            {candidata.descricao} · {formatarBRL(candidata.valor)} ·{' '}
                            {formatarDataCurta(candidata.referencia)}
                          </option>
                        ))}
                    </select>

                    <p
                      className={cn(
                        'flex items-center gap-1.5 text-xs',
                        bate === false ? 'text-atencao' : 'text-muted-foreground',
                      )}
                    >
                      {bate === null ? (
                        <>
                          <ReceiptText aria-hidden className="size-3.5" />
                          Aguardando vínculo.
                        </>
                      ) : bate ? (
                        <>
                          <CheckCircle2 aria-hidden className="size-3.5" />
                          Valor bate com a conta selecionada.
                        </>
                      ) : (
                        <>
                          <AlertTriangle aria-hidden className="size-3.5" />
                          Diferença de {formatarBRL(opcao!.diferenca.replace('-', ''))}.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-end justify-start lg:justify-end">
                    {movimentacao.status === 'conciliado' ? (
                      <span className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium text-sucesso">
                        <CheckCircle2 aria-hidden className="size-4" />
                        Conciliado
                      </span>
                    ) : (
                      <Botao
                        type="button"
                        variante="secundario"
                        carregando={processando}
                        onClick={() => conciliar(movimentacao)}
                      >
                        Conciliar
                      </Botao>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Cartao>
    </div>
  );
}

function IndicadorConciliacao({
  titulo,
  valor,
  alerta = false,
}: {
  titulo: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--sombra-sutil)]">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{titulo}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          alerta && valor > 0 && 'text-atencao',
        )}
      >
        {valor}
      </p>
    </div>
  );
}
