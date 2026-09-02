import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginacaoMeta } from '@gestao/shared-types';
import { estilosBotao } from './botao';

interface Props {
  meta: PaginacaoMeta;
  /** Rota base, sem parâmetros. */
  base: string;
  /**
   * Os outros parâmetros da URL, que precisam sobreviver à troca de página.
   *
   * Sem isso, avançar de página numa lista filtrada devolveria a lista inteira —
   * o usuário perde o filtro exatamente quando estava navegando por ele.
   */
  parametros?: Record<string, string | undefined>;
}

/**
 * Navegação entre páginas de uma listagem.
 *
 * Links de verdade, e não botões: cada página tem endereço próprio, então dá
 * para voltar pelo navegador, recarregar e mandar o link para alguém.
 *
 * Não renderiza nada quando só há uma página — um paginador dizendo "página 1
 * de 1" é ruído.
 */
export function Paginacao({ meta, base, parametros }: Props) {
  if (meta.totalPaginas <= 1) {
    return null;
  }

  const enderecoDaPagina = (destino: number) => {
    const query = new URLSearchParams({ pagina: String(destino) });

    for (const [chave, valor] of Object.entries(parametros ?? {})) {
      if (valor) query.set(chave, valor);
    }

    return `${base}?${query.toString()}`;
  };

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Paginação">
      <span className="text-muted-foreground text-sm">
        Página <span className="tabular-nums">{meta.pagina}</span> de{' '}
        <span className="tabular-nums">{meta.totalPaginas}</span>
        <span className="hidden sm:inline"> · {meta.total} no total</span>
      </span>

      <div className="flex gap-2">
        {meta.pagina > 1 && (
          <Link
            href={enderecoDaPagina(meta.pagina - 1)}
            rel="prev"
            className={estilosBotao({ variante: 'secundario', tamanho: 'sm' })}
          >
            <ChevronLeft aria-hidden />
            Anterior
          </Link>
        )}

        {meta.pagina < meta.totalPaginas && (
          <Link
            href={enderecoDaPagina(meta.pagina + 1)}
            rel="next"
            className={estilosBotao({ variante: 'secundario', tamanho: 'sm' })}
          >
            Próxima
            <ChevronRight aria-hidden />
          </Link>
        )}
      </div>
    </nav>
  );
}
