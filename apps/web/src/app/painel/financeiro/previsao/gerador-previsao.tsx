'use client';

import Link from 'next/link';
import {
  formatarBRL,
  LIMITE_PREVISOES_IA_GRATUITAS_MENSAIS,
  PACOTE_IA_PRECO_MENSAL_BRL,
  type PrevisaoFinanceiraResponse,
} from '@gestao/shared-types';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { gerarPrevisao } from './acoes';
import { GraficoFluxoProjetado } from './grafico-fluxo-projetado';

const TOM_RISCO = { baixo: 'sucesso', moderado: 'atencao', alto: 'perigo' } as const;

export function GeradorPrevisao({
  erroInicial,
  modo,
  limiteMensal,
  pacotePagoAtivo,
  resultadoInicial,
}: {
  erroInicial?: string;
  modo: 'openai' | 'demonstracao';
  limiteMensal: number | null;
  pacotePagoAtivo: boolean;
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
      <AvisoPlanoIa limiteMensal={limiteMensal} pacotePagoAtivo={pacotePagoAtivo} />

      {pacotePagoAtivo && modo === 'demonstracao' && (
        <div className="bg-atencao-suave text-atencao rounded-lg border border-current/20 px-4 py-3 text-sm">
          O modelo avançado está indisponível no momento. A previsão continua disponível com análise local.
        </div>
      )}

      <section aria-label="Período da previsão" className="flex flex-wrap items-end gap-4 border-y py-5">
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
        {gerando && <p role="status" className="mb-4 text-sm text-muted-foreground">Analisando o histórico e as contas futuras…</p>}
        {resultado ? <ResultadoPrevisao resultado={resultado} /> : !gerando && (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 border-b px-4 text-center">
            <Sparkles aria-hidden className="size-6 text-muted-foreground" />
            <h2 className="text-base font-semibold">Sua próxima decisão começa pelos números</h2>
            <p className="max-w-md text-sm text-muted-foreground">Nenhuma previsão gerada. O saldo projetado e as recomendações aparecerão aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AvisoPlanoIa({
  limiteMensal,
  pacotePagoAtivo,
}: {
  limiteMensal: number | null;
  pacotePagoAtivo: boolean;
}) {
  if (pacotePagoAtivo) {
    const textoLimite = limiteMensal === null ? 'sem limite mensal' : `até ${limiteMensal}`;

    return (
      <div className="border-b pb-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">IA Premium</span> · {textoLimite} previsões por mês.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Modo gratuito ativo</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {limiteMensal ?? LIMITE_PREVISOES_IA_GRATUITAS_MENSAIS} previsões por mês incluídas · Premium por R$ {PACOTE_IA_PRECO_MENSAL_BRL}/mês.
          </p>
        </div>
        <Link href="/painel/plano" className={estilosBotao({ variante: 'secundario' })}>
          Ver Premium
        </Link>
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
        <span>{resultado.modo === 'openai' ? 'Análise com IA' : 'Análise local gratuita'}</span>
        <span>Gerada em {new Date(resultado.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
      </div>
      {ultimoMes && <dl className="grid grid-cols-1 gap-5 border-b pb-6 sm:grid-cols-3">
        {[
          { titulo: 'Saldo ao final do período', valor: Number(ultimoMes.saldoAcumulado) },
          { titulo: 'Entradas projetadas', valor: entradas },
          { titulo: 'Saídas projetadas', valor: saidas },
        ].map((item) => <div key={item.titulo} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.titulo}</dt>
          <dd className={`mt-2 break-words text-2xl font-semibold tabular-nums ${item.valor < 0 ? 'text-destructive' : ''}`}>{formatarBRL(String(item.valor))}</dd>
        </div>)}
      </dl>}
      <section className="order-last border-t pt-6" aria-label="Análise gerencial">
        <CartaoCabecalho>
          <CartaoTitulo>Análise gerencial</CartaoTitulo>
          <Selo tom={TOM_RISCO[resultado.analise.nivelRisco]} comPonto>
            Risco {resultado.analise.nivelRisco}
          </Selo>
        </CartaoCabecalho>
        <CartaoConteudo className="flex flex-col gap-5">
          <p className="leading-relaxed">{resultado.analise.resumo}</p>
          <div className="grid gap-5 md:grid-cols-2">
            <Lista titulo="Pontos de atenção" itens={resultado.analise.pontosAtencao} alerta />
            <Lista titulo="Próximas ações" itens={resultado.analise.acoesRecomendadas} />
          </div>
        </CartaoConteudo>
        {resultado.analise.avisos.length > 0 && <div className="px-4 pb-4"><Lista titulo="Sobre esta previsão" itens={resultado.analise.avisos} alerta /></div>}
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
          <summary className="cursor-pointer px-4 py-4 text-sm font-medium">Detalhamento mensal</summary>
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
        <p className="text-muted-foreground border-t px-4 py-3 text-xs">
          {resultado.aviso}
        </p>
      </section>
    </div>
  );
}

function Lista({
  titulo,
  itens,
  alerta = false,
}: {
  titulo: string;
  itens: string[];
  alerta?: boolean;
}) {
  const Icone = alerta ? AlertTriangle : CheckCircle2;
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
