import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { AreaCarregando, EsqueletoIndicadores, EsqueletoTabela } from '@/components/ui/esqueleto';
import { CorpoDoPainel } from './corpo-financeiro';

export const metadata: Metadata = {
  title: 'Financeiro',
};

interface Props {
  searchParams: Promise<{ de?: string; ate?: string; categoriaId?: string; pagina?: string }>;
}

/**
 * Painel financeiro.
 *
 * Abre no mês corrente porque é o recorte que a pessoa quer em 90% das vezes —
 * um seletor de período vazio obrigaria a preencher duas datas antes de ver
 * qualquer coisa.
 *
 * A ordem responde: quanto entrou e saiu, o que dá lucro, e o que aconteceu.
 */
export default async function PaginaFinanceiro({ searchParams }: Props) {
  const parametros = await searchParams;
  const categoriaId = parametros.categoriaId ?? '';

  // Sem datas na URL, a API usa o mês corrente (em São Paulo) e devolve o
  // período que usou. A tela não calcula datas.
  const queryPeriodo = new URLSearchParams();
  if (parametros.de) queryPeriodo.set('de', parametros.de);
  if (parametros.ate) queryPeriodo.set('ate', parametros.ate);
  const filtrado = Boolean(parametros.de || parametros.ate || categoriaId);
  if (categoriaId) {
    queryPeriodo.set('categoriaId', categoriaId);
  }
  if (parametros.pagina) {
    queryPeriodo.set('pagina', parametros.pagina);
  }
  const periodo = queryPeriodo.toString();

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Valores da empresa, sem os pessoais."
        acoes={
          <>
            <Link
              href="/painel/financeiro/conciliacao"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Conciliação
            </Link>
            <Link
              href="/painel/financeiro/dados"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Importar / exportar
            </Link>
            <Link
              href="/painel/financeiro/recorrencias"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Recorrentes
            </Link>
            <Link
              href="/painel/financeiro/reservas"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Reservas
            </Link>
            <Link
              href="/painel/financeiro/pro-labore"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Pró-labore
            </Link>
            <Link
              href="/painel/financeiro/categorias"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Categorias
            </Link>
            <Link href="/painel/financeiro/novo" className={estilosBotao()}>
              Novo lançamento
            </Link>
          </>
        }
      />

      {/*
        O cabeçalho acima não depende de dado nenhum, então aparece na hora — com
        os botões já clicáveis. Só o corpo espera a API.

        A `key` é o período: sem ela, trocar o filtro deixaria o conteúdo antigo
        na tela enquanto o novo carrega, e o usuário leria números do recorte
        anterior achando que já eram os do novo. Com ela, o esqueleto volta e
        fica claro que aquilo ainda está sendo calculado.
      */}
      <Suspense key={periodo} fallback={<CorpoCarregando />}>
        <CorpoDoPainel categoriaId={categoriaId} filtrado={filtrado} periodo={periodo} />
      </Suspense>
    </div>
  );
}

/** O esqueleto do corpo — o cabeçalho real já está na tela acima dele. */
function CorpoCarregando() {
  return (
    <AreaCarregando rotulo="Carregando o financeiro">
      <div className="flex flex-col gap-8">
        <EsqueletoIndicadores quantidade={5} />
        <EsqueletoTabela linhas={5} colunas={5} />
        <EsqueletoTabela linhas={6} colunas={5} />
      </div>
    </AreaCarregando>
  );
}
