import type { HealthResponse } from '@gestao/shared-types';
import { apiFetch, ApiRequestError } from '@/lib/api';

/**
 * Página inicial provisória.
 *
 * Enquanto a primeira tela real não existe, ela cumpre o papel de smoke test de
 * ponta a ponta: se o status aparece verde, o frontend alcança a API, o CORS
 * está certo e o contrato de `@gestao/shared-types` casa nos dois lados.
 * Sai do ar quando o AuthModule entrar e a rota `/` virar o dashboard.
 */

// Sempre bater na API — o valor de uma página de status é mostrar o agora.
export const dynamic = 'force-dynamic';

async function buscarSaude(): Promise<
  { ok: true; dados: HealthResponse } | { ok: false; mensagem: string }
> {
  try {
    const dados = await apiFetch<HealthResponse>('/health', {
      semPrefixo: true,
      cache: 'no-store',
    });
    return { ok: true, dados };
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof ApiRequestError ? erro.message : 'Erro desconhecido.',
    };
  }
}

export default async function Home() {
  const saude = await buscarSaude();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Gestão Empresarial</h1>
        <p className="text-muted-foreground">
          CRM e financeiro no mesmo banco — margem por serviço calculada ligando receita e custo ao
          atendimento que os gerou.
        </p>
      </header>

      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Status da API
        </h2>

        {saude.ok ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Conexão</dt>
            <dd className="font-medium text-emerald-600 dark:text-emerald-400">
              Frontend e API se enxergam
            </dd>

            <dt className="text-muted-foreground">Ambiente</dt>
            <dd className="font-mono">{saude.dados.ambiente}</dd>

            <dt className="text-muted-foreground">Versão</dt>
            <dd className="font-mono">{saude.dados.versao}</dd>

            <dt className="text-muted-foreground">Resposta em</dt>
            <dd className="font-mono">{saude.dados.timestamp}</dd>
          </dl>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-destructive">API inacessível</p>
            <p className="text-muted-foreground">{saude.mensagem}</p>
            <p className="text-muted-foreground">
              Suba a API com <code className="font-mono">pnpm dev</code> e confira{' '}
              <code className="font-mono">NEXT_PUBLIC_API_URL</code> em{' '}
              <code className="font-mono">apps/web/.env.local</code>.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Próxima fatia
        </h2>
        <ol className="space-y-1.5 text-sm text-muted-foreground">
          <li>1. Schema Prisma + políticas de RLS + testes de isolamento</li>
          <li>2. Auth — login, JWT, refresh com rotação, guards de papel</li>
          <li>3. Tenant + Onboarding — signup self-service e dados-semente</li>
        </ol>
      </section>
    </main>
  );
}
