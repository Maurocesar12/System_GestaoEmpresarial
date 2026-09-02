import type { Metadata } from 'next';
import { Contact, Upload } from 'lucide-react';
import Link from 'next/link';
import {
  formatarDocumento,
  formatarTelefone,
  type Cliente,
  type Paginado,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Paginacao } from '@/components/ui/paginacao';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';
import { CampoBusca } from './campo-busca';

export const metadata: Metadata = {
  title: 'Clientes',
};

interface Props {
  searchParams: Promise<{ busca?: string; pagina?: string }>;
}

/**
 * Listagem de clientes.
 *
 * Componente de servidor: a busca acontece na API e a página chega pronta ao
 * navegador. A alternativa — carregar tudo e filtrar no cliente — pararia de
 * funcionar assim que uma empresa passasse de algumas centenas de clientes.
 *
 * Os filtros vivem na URL (`?busca=maria&pagina=2`), e não em estado do React.
 * Assim a busca é compartilhável por link, sobrevive ao recarregar a página e
 * funciona com o botão voltar do navegador.
 */
export default async function PaginaClientes({ searchParams }: Props) {
  const { busca = '', pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '20' });
  if (busca) query.set('busca', busca);

  const { dados: clientes, meta } = await apiComSessao<Paginado<Cliente>>(
    `/clientes?${query.toString()}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Clientes"
        descricao={
          meta.total === 0
            ? 'Nenhum cliente cadastrado ainda.'
            : `${meta.total} ${meta.total === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}.`
        }
        acoes={
          <>
            <Link
              href="/painel/clientes/importar"
              className={estilosBotao({ variante: 'secundario' })}
            >
              <Upload aria-hidden />
              Importar planilha
            </Link>

            <Link href="/painel/clientes/novo" className={estilosBotao()}>
              Novo cliente
            </Link>
          </>
        }
      />

      <CampoBusca valorInicial={busca} />

      {clientes.length === 0 ? (
        <EstadoVazio
          icone={Contact}
          titulo={busca ? 'Nenhum cliente encontrado' : 'Sua carteira está vazia'}
          descricao={
            busca
              ? 'Tente outro termo, ou verifique se o cliente foi cadastrado com outro nome.'
              : 'Cadastre o primeiro cliente para começar a registrar atendimentos e orçamentos.'
          }
          acao={
            busca ? undefined : (
              <Link href="/painel/clientes/novo" className={estilosBotao({ tamanho: 'sm' })}>
                Novo cliente
              </Link>
            )
          }
        />
      ) : (
        <>
          <Cartao>
            <TabelaRolavel>
              <TabelaCabecalho>
                <TabelaColuna>Nome</TabelaColuna>
                <TabelaColuna>Contato</TabelaColuna>
                <TabelaColuna>Documento</TabelaColuna>
                <TabelaColuna>Origem</TabelaColuna>
              </TabelaCabecalho>

              <TabelaCorpo>
                {clientes.map((cliente) => (
                  <TabelaLinha key={cliente.id}>
                    <TabelaCelula>
                      <Link
                        href={`/painel/clientes/${cliente.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {cliente.nome}
                      </Link>
                    </TabelaCelula>

                    <TabelaCelula suave>
                      <div className="flex flex-col">
                        {cliente.telefone && <span>{formatarTelefone(cliente.telefone)}</span>}
                        {cliente.email && <span className="text-xs">{cliente.email}</span>}
                        {!cliente.telefone && !cliente.email && <span>—</span>}
                      </div>
                    </TabelaCelula>

                    <TabelaCelula suave className="tabular-nums">
                      {formatarDocumento(cliente.documento) || '—'}
                    </TabelaCelula>

                    <TabelaCelula suave>{cliente.origem ?? '—'}</TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </TabelaRolavel>
          </Cartao>

          <Paginacao meta={meta} base="/painel/clientes" parametros={{ busca }} />
        </>
      )}
    </div>
  );
}
