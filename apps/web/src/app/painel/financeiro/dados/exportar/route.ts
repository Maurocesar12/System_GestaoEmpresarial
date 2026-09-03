import type { ExportacaoFinanceira } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export async function GET(request: Request) {
  const busca = new URL(request.url).searchParams;
  const de = busca.get('de') ?? '';
  const ate = busca.get('ate') ?? '';
  const arquivo = await apiComSessao<ExportacaoFinanceira>(
    `/financeiro/dados/exportar?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}&natureza=empresa`,
  );
  return new Response(arquivo.conteudo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${arquivo.nomeArquivo}"`,
    },
  });
}
