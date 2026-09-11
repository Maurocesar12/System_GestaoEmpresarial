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
import { EXTENSOES_ACEITAS, ErroDePlanilha, lerPlanilha, type LinhaPlanilha } from '@/lib/planilha';
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
  type Lancamento,
  type TipoLancamento,
} from '@gestao/shared-types';
import { darBaixa } from '../acoes';

interface MovimentacaoBancaria {
  id: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  valorCentavos: number;
  status: 'pendente' | 'conciliado';
}

const COLUNAS_DATA = ['data', 'dt', 'date', 'lancamento', 'lançamento'];
const COLUNAS_DESCRICAO = [
  'descricao',
  'descrição',
  'historico',
  'histórico',
  'memo',
  'detalhe',
  'documento',
];
const COLUNAS_VALOR = ['valor', 'valor r$', 'amount', 'quantia', 'movimento', 'total'];

export function ConciliadorFinanceiro({ contas }: { contas: Lancamento[] }) {
  const [falha, setFalha] = useState<string>();
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoBancaria[]>([]);
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [contasConciliadas, setContasConciliadas] = useState<Set<string>>(() => new Set());
  const [processando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  const contaPorId = useMemo(() => new Map(contas.map((conta) => [conta.id, conta])), [contas]);

  const resumo = useMemo(() => {
    const conciliadas = movimentacoes.filter((item) => item.status === 'conciliado').length;
    const sugeridas = movimentacoes.filter(
      (item) => item.status === 'pendente' && selecionados[item.id],
    ).length;
    const divergencias = movimentacoes.filter((item) => {
      const conta = contaPorId.get(selecionados[item.id] ?? '');
      return conta ? diferencaCentavos(item, conta) !== 0 : false;
    }).length;

    return {
      importadas: movimentacoes.length,
      sugeridas,
      pendentes: movimentacoes.length - conciliadas,
      divergencias,
    };
  }, [contaPorId, movimentacoes, selecionados]);

  const contasDisponiveis = useMemo(
    () => contas.filter((conta) => !contasConciliadas.has(conta.id)),
    [contas, contasConciliadas],
  );

  const importarExtrato = async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    setFalha(undefined);

    if (!arquivo) {
      return;
    }

    try {
      const planilha = await lerPlanilha(arquivo);
      const importadas = extrairMovimentacoes(planilha.cabecalhos, planilha.linhas);
      const sugestoes = Object.fromEntries(
        importadas.flatMap((movimentacao) => {
          const sugestao = sugerirConta(movimentacao, contasDisponiveis);
          return sugestao ? [[movimentacao.id, sugestao.id]] : [];
        }),
      );

      setMovimentacoes(importadas);
      setSelecionados(sugestoes);
      avisar('sucesso', `${importadas.length} movimentação(s) importada(s).`);
    } catch (erro) {
      setFalha(
        erro instanceof ErroDePlanilha || erro instanceof Error
          ? erro.message
          : 'Não foi possível ler o extrato.',
      );
    }
  };

  const conciliar = (movimentacao: MovimentacaoBancaria) => {
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
                <span className="block text-sm font-medium">Selecionar extrato</span>
                <span className="text-muted-foreground block text-xs">
                  Use uma planilha com colunas de data, descrição e valor.
                </span>
              </span>
            </span>
            <input
              type="file"
              accept={EXTENSOES_ACEITAS.join(',')}
              className="sr-only"
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
          <p className="text-muted-foreground text-xs">
            {contasDisponiveis.length} conta(s) em aberto.
          </p>
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
              const contaSelecionada = contaPorId.get(selecionados[movimentacao.id] ?? '');
              const diferenca = contaSelecionada
                ? diferencaCentavos(movimentacao, contaSelecionada)
                : null;

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
                      {formatarBRL(valorDeCentavos(movimentacao.valorCentavos))}
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
                      {contas
                        .filter(
                          (conta) =>
                            conta.tipo === movimentacao.tipo &&
                            (!contasConciliadas.has(conta.id) ||
                              conta.id === selecionados[movimentacao.id]),
                        )
                        .map((conta) => (
                          <option key={conta.id} value={conta.id}>
                            {conta.descricao} · {formatarBRL(conta.valor)} ·{' '}
                            {formatarDataCurta(conta.vencimento ?? conta.data)}
                          </option>
                        ))}
                    </select>

                    <p
                      className={cn(
                        'flex items-center gap-1.5 text-xs',
                        diferenca === null || diferenca === 0
                          ? 'text-muted-foreground'
                          : 'text-atencao',
                      )}
                    >
                      {diferenca === null ? (
                        <>
                          <ReceiptText aria-hidden className="size-3.5" />
                          Aguardando vínculo.
                        </>
                      ) : diferenca === 0 ? (
                        <>
                          <CheckCircle2 aria-hidden className="size-3.5" />
                          Valor bate com a conta selecionada.
                        </>
                      ) : (
                        <>
                          <AlertTriangle aria-hidden className="size-3.5" />
                          Diferença de {formatarBRL(valorDeCentavos(Math.abs(diferenca)))}.
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

function extrairMovimentacoes(
  cabecalhos: string[],
  linhas: LinhaPlanilha[],
): MovimentacaoBancaria[] {
  const indiceData = buscarIndice(cabecalhos, COLUNAS_DATA);
  const indiceDescricao = buscarIndice(cabecalhos, COLUNAS_DESCRICAO);
  const indiceValor = buscarIndice(cabecalhos, COLUNAS_VALOR);

  if (indiceData === -1 || indiceDescricao === -1 || indiceValor === -1) {
    throw new ErroDePlanilha(
      'Não encontrei as colunas de data, descrição e valor no extrato. Ajuste o cabeçalho e tente novamente.',
    );
  }

  return linhas.flatMap((linha, indice) => {
    const data = normalizarData(linha[indiceData] ?? '');
    const descricao = (linha[indiceDescricao] ?? '').trim();
    const valorCentavos = valorParaCentavos(linha[indiceValor] ?? '');

    if (!data || !descricao || valorCentavos === 0) {
      return [];
    }

    return [
      {
        id: `${data}-${indice}-${Math.abs(valorCentavos)}`,
        data,
        descricao,
        tipo: valorCentavos > 0 ? 'entrada' : 'saida',
        valorCentavos: Math.abs(valorCentavos),
        status: 'pendente' as const,
      },
    ];
  });
}

function buscarIndice(cabecalhos: string[], opcoes: string[]) {
  const normalizados = cabecalhos.map(normalizarTexto);
  return normalizados.findIndex((cabecalho) =>
    opcoes.some(
      (opcao) => cabecalho === normalizarTexto(opcao) || cabecalho.includes(normalizarTexto(opcao)),
    ),
  );
}

function sugerirConta(movimentacao: MovimentacaoBancaria, contas: Lancamento[]) {
  const candidatos = contas
    .filter((conta) => conta.tipo === movimentacao.tipo)
    .map((conta) => ({ conta, score: pontuarConta(movimentacao, conta) }))
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score);

  return candidatos[0]?.conta ?? null;
}

function pontuarConta(movimentacao: MovimentacaoBancaria, conta: Lancamento) {
  const diferenca = Math.abs(diferencaCentavos(movimentacao, conta));
  const dias = Math.abs(diasEntre(movimentacao.data, conta.vencimento ?? conta.data));
  const palavrasBanco = new Set(palavrasChave(movimentacao.descricao));
  const palavrasConta = palavrasChave(conta.descricao);
  const palavrasEmComum = palavrasConta.filter((palavra) => palavrasBanco.has(palavra)).length;

  let score = 0;
  score += Math.max(0, 45 - diferenca / 100);
  score += Math.max(0, 30 - dias * 4);
  score += Math.min(25, palavrasEmComum * 8);

  return score;
}

function diferencaCentavos(movimentacao: MovimentacaoBancaria, conta: Lancamento) {
  return movimentacao.valorCentavos - valorParaCentavos(conta.valor);
}

function valorParaCentavos(valor: string) {
  const texto = valor.trim();
  if (!texto) {
    return 0;
  }

  const negativo = texto.startsWith('-') || /^\(.*\)$/.test(texto);
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/[()]/g, '');
  const virgulaDecimal = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
  const normalizado = virgulaDecimal
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/,/g, '');
  const numero = Number(normalizado);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.round(Math.abs(numero) * 100) * (negativo ? -1 : 1);
}

function valorDeCentavos(centavos: number) {
  return (centavos / 100).toFixed(2);
}

function normalizarData(valor: string) {
  const texto = valor.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const dia = br[1] ?? '';
    const mes = br[2] ?? '';
    const ano = br[3] ?? '';
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  if (/^\d{5}$/.test(texto)) {
    const data = new Date(Date.UTC(1899, 11, Number(texto) - 1));
    return data.toISOString().slice(0, 10);
  }

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10);
}

function diasEntre(a: string, b: string) {
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(a) - Date.parse(b)) / umDia);
}

function palavrasChave(texto: string) {
  return normalizarTexto(texto)
    .split(/\s+/)
    .filter((palavra) => palavra.length >= 4);
}

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
