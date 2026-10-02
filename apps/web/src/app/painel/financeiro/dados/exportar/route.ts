import type { ExportacaoFinanceira } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export async function GET(request: Request) {
  const busca = new URL(request.url).searchParams;

  // Repassa só as datas que vieram: sem elas, a API exporta o mês corrente.
  const query = new URLSearchParams({ natureza: 'empresa' });
  for (const chave of ['de', 'ate']) {
    const valor = busca.get(chave);
    if (valor) query.set(chave, valor);
  }

  const arquivo = await apiComSessao<ExportacaoFinanceira>(
    `/financeiro/dados/exportar?${query.toString()}`,
  );
  return new Response(arquivo.conteudo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${arquivo.nomeArquivo}"`,
    },
  });
}
