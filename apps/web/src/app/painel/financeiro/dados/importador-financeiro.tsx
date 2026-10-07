'use client';

import { FileSpreadsheet, Upload } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { EXTENSOES_ACEITAS, lerPlanilha } from '@/lib/planilha';
import { importarLancamentos } from './acoes';

const COLUNAS = ['tipo', 'natureza', 'descricao', 'valor', 'data', 'vencimento', 'pagoEm'] as const;

/**
 * Traduz o erro da API para a linha da planilha.
 *
 * A API aponta o campo como `lancamentos.3.valor` (posição na lista, a partir
 * de zero). Quem conserta a planilha procura a linha do Excel: 3 + 2, contando
 * o cabeçalho.
 */
function descreverFalha(erro: string, campos?: Record<string, string[]>): string {
  const linhas = Object.entries(campos ?? {})
    .map(([campo, mensagens]) => {
      const [, posicao, coluna] = /^lancamentos\.(\d+)\.(\w+)/.exec(campo) ?? [];
      return posicao === undefined
        ? null
        : `Linha ${Number(posicao) + 2}, ${coluna}: ${mensagens[0]}`;
    })
    .filter((linha): linha is string => linha !== null);

  if (linhas.length === 0) return erro;

  const resto = linhas.length > 5 ? ` (e mais ${linhas.length - 5})` : '';
  return `A planilha tem dados inválidos. ${linhas.slice(0, 5).join(' · ')}${resto}`;
}

export function ImportadorFinanceiro() {
  const [dados, setDados] = useState<{ lancamentos: Record<string, string>[] }>();
  const [mensagem, setMensagem] = useState<string>();
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();

  async function carregar(arquivo: File) {
    setFalha(undefined);
    setMensagem(undefined);
    try {
      const planilha = await lerPlanilha(arquivo);
      const indices = Object.fromEntries(
        COLUNAS.map((nome) => [
          nome,
          planilha.cabecalhos.findIndex(
            (cabecalho) => cabecalho.trim().toLowerCase() === nome.toLowerCase(),
          ),
        ]),
      ) as Record<(typeof COLUNAS)[number], number>;
      const celula = (linha: string[], coluna: (typeof COLUNAS)[number]) =>
        linha[indices[coluna]]?.trim() ?? '';
      // Só leitura do arquivo: cada célula vai como está. Normalizar ("Entrada"
      // → "entrada") e validar é trabalho da API, que devolve o erro por linha.
      const lancamentos = planilha.linhas.map((linha) =>
        Object.fromEntries(COLUNAS.map((coluna) => [coluna, celula(linha, coluna)])),
      );
      setDados({ lancamentos });
      setMensagem(`${lancamentos.length} linhas lidas. A conferência acontece ao importar.`);
    } catch {
      setFalha('Não foi possível ler a planilha. Use o modelo CSV exportado pelo sistema.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {falha && <AvisoErro mensagem={falha} />}
      {mensagem && <p className="text-sucesso text-sm">{mensagem}</p>}
      <label className="hover:border-primary flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors">
        <Upload className="text-muted-foreground size-6" />
        <span className="text-sm font-medium">Escolher CSV ou Excel financeiro</span>
        <span className="text-muted-foreground text-xs">Até 500 lançamentos por importação.</span>
        <input
          type="file"
          accept={EXTENSOES_ACEITAS.join(',')}
          className="sr-only"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void carregar(arquivo);
          }}
        />
      </label>
      <Botao
        disabled={!dados}
        carregando={enviando}
        className="self-start"
        onClick={() =>
          dados &&
          iniciar(async () => {
            const resultado = await importarLancamentos(dados);
            if (resultado.erro) setFalha(descreverFalha(resultado.erro, resultado.campos));
            else {
              setMensagem(`${resultado.criados} lançamentos importados com sucesso.`);
              setDados(undefined);
            }
          })
        }
      >
        <FileSpreadsheet />
        Importar lançamentos
      </Botao>
    </div>
  );
}
