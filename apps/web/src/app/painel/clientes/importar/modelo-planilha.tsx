'use client';

import { Download } from 'lucide-react';
import { estilosBotao } from '@/components/ui/botao';

/**
 * Modelo de planilha para baixar.
 *
 * Duas escolhas deliberadas no formato:
 *
 * - **Ponto e vírgula** como separador, porque é o que o Excel em português
 *   espera. Com vírgula, ele joga a linha inteira na primeira célula e a pessoa
 *   conclui que o modelo está quebrado.
 * - **BOM** no começo do arquivo. É a marca que faz o Excel entender que o
 *   conteúdo é UTF-8; sem ela, "João" abre como "JoÃ£o" na tela de quem baixou o
 *   nosso próprio modelo.
 *
 * O arquivo é montado no navegador, sem passar pelo servidor: são três linhas
 * de texto fixo, e uma rota só para devolvê-las seria peso morto.
 */
const COLUNAS = ['Nome', 'Telefone', 'E-mail', 'CPF/CNPJ', 'Origem', 'Observações'];

const EXEMPLOS = [
  ['Maria Souza', '(11) 91234-5678', 'maria@exemplo.com', '123.456.789-09', 'Indicação', ''],
  [
    'Oficina Central Ltda',
    '1133334444',
    'contato@oficina.com.br',
    '12.345.678/0001-95',
    'Instagram',
    'Cliente desde 2024',
  ],
];

export function ModeloPlanilha() {
  function baixar(): void {
    const linhas = [COLUNAS, ...EXEMPLOS]
      .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const arquivo = new Blob([`﻿${linhas}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(arquivo);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-clientes.csv';
    link.click();

    // Libera a memória do blob assim que o download começa.
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={baixar}
      className={estilosBotao({ variante: 'secundario', tamanho: 'sm' })}
    >
      <Download aria-hidden />
      Baixar modelo de planilha
    </button>
  );
}
