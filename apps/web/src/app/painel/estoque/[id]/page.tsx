import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ROTULO_TIPO_MOVIMENTACAO,
  formatarBRL,
  possuiPermissao,
  type MaterialDetalhe,
} from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao, usuarioAtual } from '@/lib/api-servidor';
import { formatarDataCurta } from '@/lib/formatacao';
import { FormularioAjuste, FormularioEntrada, FormularioMaterial } from '../formularios';
import { quantidadeBR } from '../quantidade';

export const metadata: Metadata = { title: 'Material' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaMaterial({ params }: Props) {
  const { id } = await params;
  const [usuario, material] = await Promise.all([
    usuarioAtual(),
    apiComSessao<MaterialDetalhe>(`/estoque/materiais/${id}`),
  ]);
  const podeGerenciar = possuiPermissao(usuario, 'estoque.gerenciar');

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={material.nome}
        descricao={material.ativo ? undefined : 'Material desativado.'}
        voltar={{ href: '/painel/estoque', rotulo: 'Estoque' }}
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="Saldo"
          valor={`${quantidadeBR(material.quantidade)} ${material.unidade}`}
          tom={Number(material.quantidade) < 0 || material.abaixoDoMinimo ? 'negativo' : undefined}
          detalhe={
            material.estoqueMinimo
              ? `mínimo ${quantidadeBR(material.estoqueMinimo)}`
              : 'sem mínimo definido'
          }
        />
        <Indicador
          titulo="Custo médio"
          valor={formatarBRL(Number(material.custoMedio).toFixed(2))}
          detalhe="por unidade"
        />
        <Indicador titulo="Valor em estoque" valor={formatarBRL(material.valorEmEstoque)} />
      </FaixaDeIndicadores>

      {podeGerenciar && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Registrar entrada</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <FormularioEntrada material={material} />
            </CartaoConteudo>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Ajustar pela contagem</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo>
              <FormularioAjuste material={material} />
            </CartaoConteudo>
          </Cartao>
        </div>
      )}

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Movimentações</CartaoTitulo>
          <p className="text-muted-foreground text-xs">As 50 mais recentes.</p>
        </CartaoCabecalho>
        {material.movimentacoes.length === 0 ? (
          <CartaoConteudo className="text-muted-foreground text-sm">
            Nenhuma movimentação ainda.
          </CartaoConteudo>
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Data</TabelaColuna>
              <TabelaColuna>Tipo</TabelaColuna>
              <TabelaColuna>Detalhe</TabelaColuna>
              <TabelaColuna numerica>Quantidade</TabelaColuna>
              <TabelaColuna numerica>Valor</TabelaColuna>
            </TabelaCabecalho>
            <TabelaCorpo>
              {material.movimentacoes.map((mov) => (
                <TabelaLinha key={mov.id}>
                  <TabelaCelula suave className="whitespace-nowrap tabular-nums">
                    {formatarDataCurta(mov.data)}
                  </TabelaCelula>
                  <TabelaCelula>{ROTULO_TIPO_MOVIMENTACAO[mov.tipo]}</TabelaCelula>
                  <TabelaCelula suave className="min-w-[12rem]">
                    {mov.agendamentoId ? (
                      <Link
                        href={`/painel/agenda/${mov.agendamentoId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {mov.servicoNome ?? 'Agendamento executado'}
                      </Link>
                    ) : (
                      (mov.observacao ?? '—')
                    )}
                  </TabelaCelula>
                  <TabelaCelula numerica>
                    {mov.tipo === 'consumo' ? '− ' : mov.tipo === 'entrada' ? '+ ' : ''}
                    {quantidadeBR(mov.quantidade)}
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {formatarBRL(mov.valorTotal)}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>

      {podeGerenciar && (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Cadastro</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <FormularioMaterial material={material} />
          </CartaoConteudo>
        </Cartao>
      )}
    </div>
  );
}
