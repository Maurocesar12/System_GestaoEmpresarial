import type { Metadata } from 'next';
import Link from 'next/link';
import type { EtapaFunil, UsuarioAutenticado } from '@gestao/shared-types';
import { apiComSessao } from '@/lib/api-servidor';
import { GerenciadorEtapas } from './gerenciador';

export const metadata: Metadata = {
  title: 'Etapas do funil',
};

/**
 * Configuração das etapas do funil.
 *
 * Fora do quadro, e não dentro dele: mexer na estrutura do processo comercial é
 * raro e deliberado, enquanto arrastar cartões é diário. Misturar as duas coisas
 * na mesma tela convida ao acidente.
 */
export default async function PaginaEtapas() {
  const [etapas, usuario] = await Promise.all([
    apiComSessao<EtapaFunil[]>('/funil/etapas'),
    apiComSessao<UsuarioAutenticado>('/auth/eu'),
  ]);

  // A API já recusa quem não é admin. Aqui a checagem serve para explicar em
  // vez de mostrar uma tela que só devolve erro ao ser usada.
  if (usuario.papel !== 'admin') {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/painel/funil"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Funil
        </Link>

        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">Configuração restrita</p>
          <p className="text-muted-foreground mt-1 text-sm">
            As etapas definem o processo comercial da empresa e só o administrador pode alterá-las.
            Você continua podendo movimentar clientes no quadro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/funil"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Funil
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Etapas do funil</h1>

        <p className="text-muted-foreground text-sm">
          A sequência que o cliente percorre até fechar. Clique no nome para renomear.
        </p>
      </div>

      <GerenciadorEtapas etapas={etapas} />

      <section className="text-muted-foreground flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-foreground font-medium">Como o funil se move sozinho</p>
        <p>
          Cliente novo entra na primeira etapa. Ao emitir um orçamento, ele vai para a etapa de
          proposta enviada; ao aprovar, para a de fechamento.
        </p>
        <p>
          Essas duas etapas são reconhecidas por marcação interna, não pelo nome — você pode
          renomeá-las à vontade que a automação continua funcionando. Etapas que você criar entram
          como comuns, sem comportamento automático.
        </p>
      </section>
    </div>
  );
}
