import type { Metadata } from 'next';
import Link from 'next/link';
import { Boxes } from 'lucide-react';
import {
  formatarBRL,
  possuiPermissao,
  somarDinheiro,
  type Material,
  type Paginado,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraFiltros, CampoFiltro, LinkLimparFiltros } from '@/components/ui/filtros';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Selo } from '@/components/ui/selo';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao, usuarioAtual } from '@/lib/api-servidor';
import { quantidadeBR } from './quantidade';

export const metadata: Metadata = { title: 'Estoque' };

interface Props {
  searchParams: Promise<{ busca?: string; repor?: string }>;
}

export default async function PaginaEstoque({ searchParams }: Props) {
  const { busca = '', repor } = await searchParams;
  const query = new URLSearchParams({ porPagina: '100' });
  if (busca) query.set('busca', busca);
  if (repor) query.set('abaixoDoMinimo', 'true');

  const [usuario, materiais, paraRepor] = await Promise.all([
    usuarioAtual(),
    apiComSessao<Paginado<Material>>(`/estoque/materiais?${query.toString()}`),
    apiComSessao<Paginado<Material>>('/estoque/materiais?abaixoDoMinimo=true&porPagina=1'),
  ]);

  const podeGerenciar = possuiPermissao(usuario, 'estoque.gerenciar');
  const valorTotal = somarDinheiro(materiais.dados.map((material) => material.valorEmEstoque));
  const filtroAtivo = Boolean(busca || repor);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Estoque"
        descricao="Materiais usados nos serviços, com saldo e custo médio."
        acoes={
          podeGerenciar && (
            <Link href="/painel/estoque/novo" className={estilosBotao()}>
              Novo material
            </Link>
          )
        }
      />

      <FaixaDeIndicadores>
        <Indicador titulo="Materiais" valor={String(materiais.meta.total)} />
        <Indicador
          titulo="Valor em estoque"
          valor={formatarBRL(valorTotal)}
          detalhe="saldo × custo médio"
        />
        <Indicador
          titulo="Para repor"
          valor={String(paraRepor.meta.total)}
          tom={paraRepor.meta.total > 0 ? 'negativo' : undefined}
          detalhe="no mínimo ou abaixo"
        />
      </FaixaDeIndicadores>

      <BarraFiltros ativo={filtroAtivo}>
        <CampoFiltro
          rotulo="Buscar"
          name="busca"
          defaultValue={busca}
          placeholder="Nome do material"
          className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        />
        <label className="text-muted-foreground flex h-9 items-center gap-2 px-1 text-sm">
          <input name="repor" type="checkbox" value="1" defaultChecked={Boolean(repor)} />
          Para repor
        </label>
        <button type="submit" className={estilosBotao({ tamanho: 'sm', variante: 'secundario' })}>
          Filtrar
        </button>
        <LinkLimparFiltros href="/painel/estoque" ativo={filtroAtivo} />
      </BarraFiltros>

      <Cartao>
        {materiais.dados.length === 0 ? (
          <EstadoVazio
            icone={Boxes}
            titulo="Nenhum material encontrado"
            descricao="Cadastre os materiais que você usa nos serviços para o custo deles entrar na margem."
            className="border-0"
          />
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Material</TabelaColuna>
              <TabelaColuna numerica>Saldo</TabelaColuna>
              <TabelaColuna numerica>Mínimo</TabelaColuna>
              <TabelaColuna numerica>Custo médio</TabelaColuna>
              <TabelaColuna numerica>Valor</TabelaColuna>
            </TabelaCabecalho>
            <TabelaCorpo>
              {materiais.dados.map((material) => (
                <TabelaLinha key={material.id}>
                  <TabelaCelula className="min-w-[14rem]">
                    <Link
                      href={`/painel/estoque/${material.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {material.nome}
                    </Link>
                    <div className="mt-1 flex gap-1.5">
                      {Number(material.quantidade) < 0 ? (
                        <Selo tom="perigo">Saldo negativo</Selo>
                      ) : (
                        material.abaixoDoMinimo && <Selo tom="atencao">Repor</Selo>
                      )}
                      {!material.ativo && (
                        <span className="text-muted-foreground text-xs">Desativado</span>
                      )}
                    </div>
                  </TabelaCelula>
                  <TabelaCelula numerica>
                    {quantidadeBR(material.quantidade)} {material.unidade}
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {material.estoqueMinimo ? quantidadeBR(material.estoqueMinimo) : '—'}
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {formatarBRL(Number(material.custoMedio).toFixed(2))}
                  </TabelaCelula>
                  <TabelaCelula numerica className="font-medium">
                    {formatarBRL(material.valorEmEstoque)}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>
    </div>
  );
}
