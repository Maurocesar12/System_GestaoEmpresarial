import type { DadosDoTitular } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await apiComSessao<DadosDoTitular>(
    `/clientes/${encodeURIComponent(id)}/dados-pessoais`,
  );

  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-pessoais-${dados.cliente.id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
