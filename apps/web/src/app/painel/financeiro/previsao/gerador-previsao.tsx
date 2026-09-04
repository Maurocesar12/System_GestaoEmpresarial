'use client';

import { formatarBRL, type PrevisaoFinanceiraResponse } from '@gestao/shared-types';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { gerarPrevisao } from './acoes';
import { GraficoFluxoProjetado } from './grafico-fluxo-projetado';

const TOM_RISCO = { baixo: 'sucesso', moderado: 'atencao', alto: 'perigo' } as const;

export function GeradorPrevisao({
  modo,
  resultadoInicial,
}: {
  modo: 'openai' | 'demonstracao';
  resultadoInicial: PrevisaoFinanceiraResponse | null;
}) {
  const [resultado, setResultado] = useState<PrevisaoFinanceiraResponse | undefined>(
    resultadoInicial ?? undefined,
  );
  const [erro, setErro] = useState<string>();
  const [mesesHistorico, setMesesHistorico] = useState(6);
  const [mesesProjecao, setMesesProjecao] = useState(3);
  const [gerando, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {modo === 'demonstracao' && (
        <div className="bg-atencao-suave text-atencao rounded-lg border border-current/20 px-4 py-3 text-sm">
          Modo de demonstração ativo: a conta OpenAI ainda não está conectada. O cálculo funciona
          localmente e não gera custo.
        </div>
      )}

      <Cartao>
        <CartaoConteudo className="flex flex-wrap items-end gap-4">
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
                setResultado(resposta.dados);
              })
            }
          >
            <Sparkles /> Gerar previsão
          </Botao>
        </CartaoConteudo>
      </Cartao>

      {erro && <AvisoErro mensagem={erro} />}
      {resultado && <ResultadoPrevisao resultado={resultado} />}
    </div>
  );
}

function ResultadoPrevisao({ resultado }: { resultado: PrevisaoFinanceiraResponse }) {
  return (
    <div className="flex flex-col gap-6">
      <Cartao>
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
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Fluxo projetado</CartaoTitulo>
          <span className="text-muted-foreground text-xs">
            {resultado.quota.usado}/{resultado.quota.limite ?? '∞'} previsões no mês
          </span>
        </CartaoCabecalho>
        <GraficoFluxoProjetado projecoes={resultado.projecoes} />
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
                    className={`px-4 py-3 font-semibold tabular-nums ${Number(item.saldoAcumulado) < 0 ? 'text-destructive' : 'text-sucesso'}`}
                  >
                    {formatarBRL(item.saldoAcumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground border-t px-4 py-3 text-xs">
          {resultado.aviso} ·{' '}
          {resultado.modo === 'openai'
            ? `${resultado.consumo.inputTokens + resultado.consumo.outputTokens} tokens · US$ ${resultado.consumo.custoEstimadoUsd}`
            : 'análise local sem custo'}
        </p>
      </Cartao>
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
