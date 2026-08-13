import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Painel — Gestão Empresarial',
};

/**
 * Painel provisório.
 *
 * Marca o fim do caminho de entrada: cadastrar, entrar e chegar a uma área
 * autenticada. O conteúdo real — funil, agenda, fluxo de caixa — chega nas
 * próximas fatias, cada uma substituindo um dos cartões abaixo.
 */
export default function PaginaPainel() {
  const proximasFatias = [
    { titulo: 'Orçamentos', descricao: 'Emissão, envio e acompanhamento de status.' },
    { titulo: 'Agendamentos', descricao: 'Serviços agendados e execução.' },
    { titulo: 'Financeiro', descricao: 'Entradas, saídas, fluxo de caixa e margem por serviço.' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="text-muted-foreground text-sm">
          Sua empresa está criada e as etapas do funil já foram configuradas.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Em construção
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {proximasFatias.map((fatia) => (
            <li key={fatia.titulo} className="rounded-lg border p-4">
              <h3 className="text-sm font-medium">{fatia.titulo}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{fatia.descricao}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
