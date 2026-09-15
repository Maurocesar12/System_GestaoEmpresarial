import type { ExportacaoEmpresa } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export async function GET() {
  const dados = await apiComSessao<ExportacaoEmpresa>('/conta/exportar');

  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-empresa-${dados.geradoEm.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
