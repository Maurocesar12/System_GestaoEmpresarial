'use client';

import { importacaoLancamentosSchema, type ImportacaoLancamentosInput } from '@gestao/shared-types';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { lerPlanilha } from '@/lib/planilha';
import { importarLancamentos } from './acoes';

const COLUNAS = ['tipo', 'natureza', 'descricao', 'valor', 'data', 'vencimento', 'pagoEm'] as const;

export function ImportadorFinanceiro() {
  const [dados, setDados] = useState<ImportacaoLancamentosInput>();
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
      const bruto = {
        lancamentos: planilha.linhas.map((linha) => ({
          tipo: celula(linha, 'tipo').toLowerCase(),
          natureza: celula(linha, 'natureza').toLowerCase() || 'empresa',
          descricao: celula(linha, 'descricao'),
          valor: celula(linha, 'valor'),
          data: celula(linha, 'data'),
          vencimento: celula(linha, 'vencimento') || null,
          pagoEm: celula(linha, 'pagoEm') || null,
        })),
      };
      const validacao = importacaoLancamentosSchema.safeParse(bruto);
      if (!validacao.success) {
        setFalha(
          `A planilha contém dados inválidos. Confira tipo (entrada/saida), valor e datas. ${validacao.error.issues[0]?.message ?? ''}`,
        );
        return;
      }
      setDados(validacao.data);
      setMensagem(`${validacao.data.lancamentos.length} lançamentos prontos para importar.`);
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
          accept=".csv,.xlsx,.xls"
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
            if (resultado.erro) setFalha(resultado.erro);
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
