'use client';

import {
  formatarBRL,
  type BaseDaPrevisao,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { gerarPrevisao } from './acoes';
import { GraficoFluxoProjetado } from './grafico-fluxo-projetado';

const TOM_RISCO = { baixo: 'sucesso', moderado: 'atencao', alto: 'perigo' } as const;

/**
 * O gerador só é renderizado para quem tem o Premium — a tela decide isso antes
 * (`page.tsx`), então aqui não existe mais o caminho "modo gratuito". O que
 * sobra é o aviso de quando o modelo está indisponível e a análise local
 * assumiu, que quem paga precisa saber.
 */
export function GeradorPrevisao({
  erroInicial,
  modo,
  limiteMensal,
  resultadoInicial,
}: {
  erroInicial?: string;
  modo: 'openai' | 'demonstracao';
  limiteMensal: number | null;
  resultadoInicial: PrevisaoFinanceiraResponse | null;
}) {
  const [resultado, setResultado] = useState<PrevisaoFinanceiraResponse | undefined>(
    resultadoInicial ?? undefined,
  );
  const [erro, setErro] = useState<string | undefined>(erroInicial);
  const [mesesHistorico, setMesesHistorico] = useState(6);
  const [mesesProjecao, setMesesProjecao] = useState(3);
  const [gerando, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="text-muted-foreground border-b pb-3 text-sm">
        <span className="text-foreground font-semibold">IA Premium</span> ·{' '}
        {limiteMensal === null ? 'sem limite mensal' : `até ${limiteMensal}`} previsões por mês.
      </div>

      {modo === 'demonstracao' && (
        <div className="bg-atencao-suave text-atencao rounded-lg border border-current/20 px-4 py-3 text-sm">
          O modelo avançado está indisponível no momento. A previsão continua disponível com análise
          local.
        </div>
      )}

      <section
        aria-label="Período da previsão"
        className="flex flex-wrap items-end gap-4 border-y py-5"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Histórico analisado</span>
          <select
            className="bg-background h-10 rounded-md border px-3"
            value={mesesHistorico}
            onChange={(evento) => setMesesHistorico(Number(evento.target.value))}
          >
            {[3, 6, 9, 12].map((valor) => (
              <option key={valor} value={valor}>
                {valor} meses
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Período projetado</span>
          <select
            className="bg-background h-10 rounded-md border px-3"
            value={mesesProjecao}
            onChange={(evento) => setMesesProjecao(Number(evento.target.value))}
          >
            {[1, 3, 6].map((valor) => (
              <option key={valor} value={valor}>
                {valor} meses
              </option>
            ))}
          </select>
        </label>
        <Botao
          carregando={gerando}
          onClick={() =>
            iniciar(async () => {
              setErro(undefined);
              const resposta = await gerarPrevisao({ mesesHistorico, mesesProjecao });
              setErro(resposta.erro);
              if (resposta.dados) setResultado(resposta.dados);
            })
          }
        >
          <Sparkles /> Gerar previsão
        </Botao>
      </section>

      {erro && <AvisoErro mensagem={erro} />}
      <div aria-live="polite" aria-busy={gerando}>
        {gerando && (
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            Analisando o histórico e as contas futuras…
          </p>
        )}
        {resultado ? (
          <ResultadoPrevisao resultado={resultado} />
        ) : (
          !gerando && (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 border-b px-4 text-center">
              <Sparkles aria-hidden className="size-6 text-muted-foreground" />
              <h2 className="text-base font-semibold">Sua próxima decisão começa pelos números</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Nenhuma previsão gerada. O saldo projetado e as recomendações aparecerão aqui.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ResultadoPrevisao({ resultado }: { resultado: PrevisaoFinanceiraResponse }) {
  const ultimoMes = resultado.projecoes.at(-1);
  const entradas = resultado.projecoes.reduce((total, mes) => total + Number(mes.entradas), 0);
  const saidas = resultado.projecoes.reduce((total, mes) => total + Number(mes.saidas), 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {resultado.modo === 'openai'
            ? 'Análise com IA'
            : 'Análise local — o modelo não respondeu desta vez'}
        </span>
        <span>
          Gerada em{' '}
          {new Date(resultado.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </span>
      </div>
      {ultimoMes && (
        <dl className="grid grid-cols-1 gap-5 border-b pb-6 sm:grid-cols-3">
          {[
            { titulo: 'Saldo ao final do período', valor: Number(ultimoMes.saldoAcumulado) },
            { titulo: 'Entradas projetadas', valor: entradas },
            { titulo: 'Saídas projetadas', valor: saidas },
          ].map((item) => (
            <div key={item.titulo} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{item.titulo}</dt>
              <dd
                className={`mt-2 break-words text-2xl font-semibold tabular-nums ${item.valor < 0 ? 'text-destructive' : ''}`}
              >
                {formatarBRL(String(item.valor))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <section className="order-last border-t pt-6" aria-label="Análise gerencial">
        <CartaoCabecalho>
          <CartaoTitulo>Análise gerencial</CartaoTitulo>
          <Selo tom={TOM_RISCO[resultado.analise.nivelRisco]} comPonto>
            Risco {resultado.analise.nivelRisco}
          </Selo>
        </CartaoCabecalho>
        <CartaoConteudo className="flex flex-col gap-5">
          <p className="leading-relaxed">{resultado.analise.resumo}</p>

          {resultado.analise.cenarios && <Cenarios cenarios={resultado.analise.cenarios} />}

          <div className="grid gap-5 md:grid-cols-2">
            <Lista titulo="Pontos de atenção" itens={resultado.analise.pontosAtencao} alerta />
            <Lista titulo="Próximas ações" itens={resultado.analise.acoesRecomendadas} />
          </div>

          {resultado.analise.oportunidades && resultado.analise.oportunidades.length > 0 && (
            <Lista
              titulo="Onde há dinheiro a ganhar"
              itens={resultado.analise.oportunidades}
              icone={Lightbulb}
            />
          )}
        </CartaoConteudo>
        {resultado.analise.avisos.length > 0 && (
          <div className="px-4 pb-4">
            <Lista titulo="Sobre esta previsão" itens={resultado.analise.avisos} alerta />
          </div>
        )}
      </section>

      <section className="min-w-0" aria-label="Fluxo projetado">
        <CartaoCabecalho>
          <CartaoTitulo>Fluxo projetado</CartaoTitulo>
          <span className="text-muted-foreground text-xs">
            {resultado.quota.usado}/{resultado.quota.limite ?? '∞'} previsões no mês
          </span>
        </CartaoCabecalho>
        <GraficoFluxoProjetado projecoes={resultado.projecoes} />
        <details className="border-b">
          <summary className="cursor-pointer px-4 py-4 text-sm font-medium">
            Detalhamento mensal
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  {['Mês', 'Entradas', 'Saídas', 'Saldo do mês', 'Saldo acumulado'].map((item) => (
                    <th key={item} className="px-4 py-3 font-medium">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.projecoes.map((item) => (
                  <tr key={item.mes} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{formatarMes(item.mes)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatarBRL(item.entradas)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatarBRL(item.saidas)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatarBRL(item.saldo)}</td>
                    <td
                      className={`px-4 py-3 font-semibold tabular-nums ${Number(item.saldoAcumulado) < 0 ? 'text-destructive' : ''}`}
                    >
                      {formatarBRL(item.saldoAcumulado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-muted-foreground border-t px-4 py-3 text-xs">{resultado.aviso}</p>
      </section>

      {resultado.baseDeDados && <BaseDeDados base={resultado.baseDeDados} />}
    </div>
  );
}

/**
 * Os três desfechos plausíveis, lado a lado.
 *
 * Uma projeção de número único esconde a incerteza que ela tem. Ver o
 * pessimista ao lado do base é o que impede alguém de assumir um compromisso
 * apoiado na melhor hipótese.
 */
function Cenarios({
  cenarios,
}: {
  cenarios: NonNullable<PrevisaoFinanceiraResponse['analise']['cenarios']>;
}) {
  const itens = [
    { rotulo: 'Pessimista', texto: cenarios.pessimista, cor: 'border-destructive/30' },
    { rotulo: 'Base', texto: cenarios.base, cor: 'border-primary/30' },
    { rotulo: 'Otimista', texto: cenarios.otimista, cor: 'border-sucesso/30' },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {itens.map((item) => (
        <div key={item.rotulo} className={`rounded-lg border-l-2 bg-muted/30 p-3 ${item.cor}`}>
          <p className="text-xs font-semibold tracking-wide uppercase">{item.rotulo}</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.texto}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * O que entrou na conta.
 *
 * Previsão sem procedência vira adivinhação: quem lê precisa saber se os
 * números consideraram as propostas em aberto e os agendamentos do mês que vem,
 * ou se olharam só para o extrato.
 */
function BaseDeDados({ base }: { base: BaseDaPrevisao }) {
  const itens = [
    { rotulo: 'Lançamentos analisados', valor: String(base.lancamentosAnalisados) },
    { rotulo: 'Meses de histórico', valor: String(base.mesesHistorico) },
    { rotulo: 'Clientes na carteira', valor: String(base.clientesNaCarteira) },
    {
      rotulo: 'Propostas em aberto',
      valor: `${base.propostasAbertas.quantidade} · ${formatarBRL(base.propostasAbertas.valor)}`,
    },
    { rotulo: 'Taxa de conversão', valor: `${Math.round(base.taxaConversao * 100)}%` },
    { rotulo: 'Ticket médio', valor: formatarBRL(base.ticketMedio) },
    { rotulo: 'Serviços agendados', valor: String(base.agendamentosFuturos) },
    { rotulo: 'Compromissos mensais', valor: formatarBRL(base.compromissosRecorrentes) },
    {
      rotulo: 'Contas vencidas',
      valor: `${base.contasVencidas.quantidade} · ${formatarBRL(base.contasVencidas.valor)}`,
    },
  ];

  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        O que entrou nesta previsão
      </summary>

      <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-3">
        {itens.map((item) => (
          <div key={item.rotulo}>
            <dt className="text-muted-foreground text-xs">{item.rotulo}</dt>
            <dd className="text-sm font-medium tabular-nums">{item.valor}</dd>
          </div>
        ))}
      </div>

      {base.maioresSaidas.length > 0 && (
        <div className="border-t px-4 py-3">
          <p className="text-muted-foreground text-xs">Maiores saídas do período</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {base.maioresSaidas.map((saida) => (
              <li key={saida.categoria} className="text-sm">
                {saida.categoria}{' '}
                <span className="text-muted-foreground tabular-nums">
                  {formatarBRL(saida.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

function Lista({
  titulo,
  itens,
  alerta = false,
  icone,
}: {
  titulo: string;
  itens: string[];
  alerta?: boolean;
  icone?: typeof AlertTriangle;
}) {
  const Icone = icone ?? (alerta ? AlertTriangle : CheckCircle2);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {itens.map((item) => (
          <li key={item} className="text-muted-foreground flex gap-2 text-sm">
            <Icone className="text-primary mt-0.5 size-4 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatarMes(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
