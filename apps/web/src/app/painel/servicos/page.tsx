import type { Metadata } from 'next';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { formatarBRL, margemPercentual, type Paginado, type Servico } from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { PercentualMargem } from '@/components/ui/percentual-margem';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = {
  title: 'Serviços',
};

export default async function PaginaServicos() {
  const { dados: servicos } = await apiComSessao<Paginado<Servico>>('/servicos?porPagina=100');

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Serviços"
        descricao="O custo base de cada serviço é o que torna a margem calculável."
        acoes={
          <Link href="/painel/servicos/novo" className={estilosBotao()}>
            Novo serviço
          </Link>
        }
      />

      {servicos.length === 0 ? (
        <EstadoVazio
          icone={Wrench}
          titulo="Nenhum serviço cadastrado"
          descricao="Cadastre o que você vende, com quanto custa executar. É esse número que permite saber, depois, quanto cada tipo de serviço deixa de lucro."
          acao={
            <Link href="/painel/servicos/novo" className={estilosBotao({ tamanho: 'sm' })}>
              Novo serviço
            </Link>
          }
        />
      ) : (
        <Cartao>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Serviço</TabelaColuna>
              <TabelaColuna numerica>Custo</TabelaColuna>
              <TabelaColuna numerica>Preço</TabelaColuna>
              <TabelaColuna numerica>Margem</TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {servicos.map((servico) => (
                <TabelaLinha
                  key={servico.id}
                  // Desativado fica visível, mas apagado: some das telas de uso
                  // e continua no histórico.
                  className={servico.ativo ? undefined : 'opacity-50'}
                >
                  <TabelaCelula>
                    <Link
                      href={`/painel/servicos/${servico.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {servico.nome}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {servico.categoria ?? '—'}
                      {!servico.ativo && ' · desativado'}
                    </div>
                  </TabelaCelula>

                  <TabelaCelula numerica>{formatarBRL(servico.custoBase)}</TabelaCelula>

                  <TabelaCelula numerica>
                    {servico.precoPadrao ? formatarBRL(servico.precoPadrao) : '—'}
                  </TabelaCelula>

                  <TabelaCelula numerica>
                    <PercentualMargem
                      percentual={margemPercentual(servico.custoBase, servico.precoPadrao)}
                    />
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}
    </div>
  );
}
