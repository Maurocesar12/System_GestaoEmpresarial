import Link from 'next/link';
import { Paperclip, Receipt, TrendingUp } from 'lucide-react';
import {
  ROTULO_NATUREZA,
  ROTULO_STATUS_LANCAMENTO,
  ROTULO_TIPO_LANCAMENTO,
  formatarBRL,
  type CategoriaFinanceira,
  type FluxoDeCaixa,
  type PainelFinanceiro,
} from '@gestao/shared-types';
import { BarraMagnitude, BarraProporcao } from '@/components/ui/barra-proporcao';
import { estilosBotao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { DicaConceito } from '@/components/ui/dica-conceito';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  BarraFiltros,
  CampoFiltro,
  LinkLimparFiltros,
  SelecaoFiltro,
} from '@/components/ui/filtros';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Paginacao } from '@/components/ui/paginacao';
import { PercentualMargem } from '@/components/ui/percentual-margem';
import { Selo } from '@/components/ui/selo';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDataCurta, formatarPeriodo } from '@/lib/formatacao';
import { SecaoContas } from './secao-contas';

/** O corpo do painel financeiro: filtros, indicadores, gráficos e listas do período. */

/**
 * Cor de cada situação.
 *
 * Verde é desfecho resolvido, vermelho é prazo estourado, âmbar é algo que
 * ainda depende de alguém. O texto do selo acompanha sempre — cor sozinha não
 * comunica para quem não distingue as duas primeiras.
 */
const TOM_DO_STATUS = {
  pago: 'sucesso',
  atrasado: 'perigo',
  a_vencer: 'atencao',
} as const;

/**
 * O painel em si.
 *
 * Uma chamada só. Antes eram oito, e cada uma atravessava Vercel → Render →
 * Neon por conta própria: em hospedagem gratuita, com frontend e API em regiões
 * diferentes, a viagem custava mais que as consultas. A API continua fazendo o
 * mesmo trabalho em paralelo, só que ao lado do banco.
 */
export async function CorpoDoPainel({
  categoriaId,
  filtrado,
  periodo,
}: {
  categoriaId: string;
  filtrado: boolean;
  periodo: string;
}) {
  const { fluxo, custo, margem, lancamentos, resumoContas, contasEmAberto, categorias } =
    await apiComSessao<PainelFinanceiro>(`/financeiro/painel?${periodo}`);

  // O período que a API de fato usou — o mês corrente dela, quando a URL não
  // trouxe datas.
  const { de, ate } = fluxo.periodo;

  const saldoNegativo = Number(fluxo.saldo) < 0;

  // A maior receita da lista dá a escala das barras da tabela de margem. Sem um
  // teto comum, cada linha se compararia consigo mesma e a coluna deixaria de
  // ser comparável de cima a baixo.
  const maiorReceita = Math.max(...margem.itens.map((item) => Number(item.receita)), 0);

  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground -mb-4 text-sm">{formatarPeriodo(de, ate)}</p>

      <FiltrosFinanceiros
        de={de}
        ate={ate}
        categoriaId={categoriaId}
        categorias={categorias}
        ativo={filtrado}
      />

      <FaixaDeIndicadores>
        {/* O detalhe "recebido/pago no período" é o par da legenda da tabela de
            lançamentos: aqui conta o dinheiro que se moveu, lá o que foi
            registrado. Dizer nos dois lugares é o que impede a conclusão de que
            um dos números está errado. */}
        <Indicador
          titulo="Entradas"
          valor={formatarBRL(fluxo.entradas)}
          detalhe="recebido no período"
          tom="positivo"
          conceito="entradas"
        />
        <Indicador
          titulo="Saídas"
          valor={formatarBRL(fluxo.saidas)}
          detalhe="pago no período"
          tom="negativo"
          conceito="saidas"
        />
        <Indicador
          titulo="Saldo"
          valor={formatarBRL(fluxo.saldo)}
          tom={saldoNegativo ? 'negativo' : 'positivo'}
          detalhe={saldoNegativo ? 'saiu mais do que entrou' : 'sobrou no período'}
          destaque
          conceito="saldo"
          passos={[
            { rotulo: 'Entradas', valor: formatarBRL(fluxo.entradas) },
            { rotulo: 'Saídas', valor: formatarBRL(fluxo.saidas), operador: '−' },
            { rotulo: 'Saldo', valor: formatarBRL(fluxo.saldo), operador: '=' },
          ]}
        />
        <Indicador
          titulo="Custo fixo"
          valor={formatarBRL(fluxo.custoFixo)}
          detalhe="o que custa igual todo mês"
          conceito="custo-fixo"
        />
        <Indicador
          titulo="Custo por dia"
          valor={formatarBRL(custo.custoOperacionalDiario)}
          detalhe={
            custo.proLaboreMensal
              ? 'custo fixo + pró-labore, por dia'
              : 'só custo fixo, sem pró-labore registrado'
          }
          conceito="custo-por-dia"
          passos={[
            { rotulo: 'Custo fixo por dia', valor: formatarBRL(custo.custoFixoDiario) },
            {
              rotulo: 'Pró-labore por dia',
              valor: formatarBRL(custo.proLaboreDiario),
              operador: '+',
            },
            {
              rotulo: 'Custo por dia',
              valor: formatarBRL(custo.custoOperacionalDiario),
              operador: '=',
            },
          ]}
        />
      </FaixaDeIndicadores>

      <ComposicaoDasSaidas fluxo={fluxo} />

      <SecaoContas resumo={resumoContas} contas={contasEmAberto} />

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2" conceito="margem">
            <TrendingUp aria-hidden className="text-muted-foreground size-4" />
            Margem por serviço
          </CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">
            Receita menos custo direto, materiais usados e comissões.
          </p>
        </CartaoCabecalho>

        {margem.itens.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={TrendingUp}
              titulo="Nenhum serviço com movimento no período"
              descricao="Vincule as entradas e saídas a um serviço para descobrir quais dão mais lucro."
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <>
            <TabelaRolavel>
              <TabelaCabecalho>
                <TabelaColuna>Serviço</TabelaColuna>
                <TabelaColuna numerica>Receita</TabelaColuna>
                <TabelaColuna numerica>Custo</TabelaColuna>
                <TabelaColuna numerica>Margem</TabelaColuna>
                <TabelaColuna numerica conceito="margem-percentual">
                  %
                </TabelaColuna>
              </TabelaCabecalho>

              <TabelaCorpo>
                {margem.itens.map((item) => (
                  <TabelaLinha key={item.servicoId ?? 'sem'}>
                    <TabelaCelula className="min-w-[12rem]">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium">
                          {item.servicoNome}
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {item.quantidade}×
                          </span>
                        </span>
                        <BarraMagnitude valor={Number(item.receita)} maximo={maiorReceita} />
                      </div>
                    </TabelaCelula>

                    <TabelaCelula numerica>{formatarBRL(item.receita)}</TabelaCelula>
                    <TabelaCelula numerica suave>
                      {formatarBRL(item.custo)}
                      {(Number(item.custoMateriais) > 0 || Number(item.custoComissoes) > 0) && (
                        <div className="text-xs whitespace-nowrap">
                          materiais {formatarBRL(item.custoMateriais)} · comissões{' '}
                          {formatarBRL(item.custoComissoes)}
                        </div>
                      )}
                    </TabelaCelula>
                    <TabelaCelula numerica className="font-medium">
                      {formatarBRL(item.margem)}
                    </TabelaCelula>
                    <TabelaCelula numerica>
                      <PercentualMargem percentual={item.margemPercentual} />
                    </TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </TabelaRolavel>

            {/* Receita sem serviço não some do relatório: uma lacuna visível é
                melhor que um número silenciosamente incompleto. */}
            {Number(margem.receitaSemServico) > 0 && (
              <p className="text-muted-foreground border-t px-4 py-3 text-xs">
                {formatarBRL(margem.receitaSemServico)} de receita não está vinculada a nenhum
                serviço e ficou fora deste cálculo.
              </p>
            )}
          </>
        )}
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2" conceito="data-do-pagamento">
            <Receipt aria-hidden className="text-muted-foreground size-4" />
            Lançamentos do período
          </CartaoTitulo>
          {/*
            Esta legenda evita a leitura errada mais fácil da tela.

            Os indicadores lá em cima somam por data de **pagamento**; esta
            lista filtra por data do **lançamento**. São recortes diferentes de
            propósito — um mostra o dinheiro que se moveu, o outro o que foi
            registrado —, mas sem dizer isso a pessoa via um serviço de R$ 5.000
            na lista e "Entradas: R$ 0" acima, e concluía que o sistema errou.
          */}
          <p className="text-muted-foreground shrink-0 text-xs">
            Pela data do lançamento, inclui o que ainda não foi pago.
          </p>
        </CartaoCabecalho>

        {lancamentos.dados.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={Receipt}
              titulo="Nenhum lançamento neste período"
              descricao="Registre o que entrou e o que saiu para o painel começar a responder."
              acao={
                <Link href="/painel/financeiro/novo" className={estilosBotao({ tamanho: 'sm' })}>
                  Novo lançamento
                </Link>
              }
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Data</TabelaColuna>
              <TabelaColuna>Descrição</TabelaColuna>
              <TabelaColuna>Categoria</TabelaColuna>
              <TabelaColuna>Situação</TabelaColuna>
              <TabelaColuna>Anexos</TabelaColuna>
              <TabelaColuna numerica>Valor</TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {lancamentos.dados.map((lancamento) => (
                <TabelaLinha key={lancamento.id}>
                  <TabelaCelula suave className="tabular-nums whitespace-nowrap">
                    {formatarDataCurta(lancamento.data)}
                  </TabelaCelula>

                  <TabelaCelula className="min-w-[14rem]">
                    <Link
                      href={`/painel/financeiro/${lancamento.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {lancamento.descricao}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {lancamento.servicoNome ?? ROTULO_TIPO_LANCAMENTO[lancamento.tipo]}
                      {lancamento.natureza === 'pessoal' &&
                        ` · ${ROTULO_NATUREZA[lancamento.natureza]}`}
                      {/* Cada parcela é uma linha própria na tabela. Sem o
                          "2/3", três linhas de R$ 333,33 no mesmo mês pareceriam
                          três cobranças diferentes do mesmo cliente. */}
                      {lancamento.parcelamento &&
                        ` · parcela ${lancamento.parcelamento.parcela}/${lancamento.parcelamento.total}`}
                      {lancamento.recorrenciaId && ' · recorrente'}
                    </div>
                  </TabelaCelula>

                  <TabelaCelula suave>{lancamento.categoriaNome ?? '—'}</TabelaCelula>

                  <TabelaCelula>
                    {/* Só leitura aqui: dar baixa é ação da seção de contas
                          em aberto, e repetir o botão nos dois lugares
                          espalharia a mesma decisão por duas telas. */}
                    <Selo tom={TOM_DO_STATUS[lancamento.status]}>
                      {ROTULO_STATUS_LANCAMENTO[lancamento.status]}
                    </Selo>
                  </TabelaCelula>

                  <TabelaCelula suave>
                    {lancamento.anexos.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Paperclip aria-hidden className="size-3.5" />
                        {lancamento.anexos.length}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TabelaCelula>

                  <TabelaCelula
                    numerica
                    className={
                      lancamento.tipo === 'entrada'
                        ? 'text-sucesso font-medium'
                        : 'text-destructive font-medium'
                    }
                  >
                    {lancamento.tipo === 'saida' && '− '}
                    {formatarBRL(lancamento.valor)}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>

      {/*
        Sem isto, a tela mostrava as 20 primeiras linhas e o resto do mês era
        inalcançável — a única saída era exportar a planilha.

        Fica fora do cartão, como nas outras listagens do sistema: o componente
        devolve `null` quando há uma página só, e dentro do cartão isso deixaria
        uma faixa com borda e nada dentro.

        Os filtros vão no `parametros` para sobreviverem à troca de página. O
        caminho inverso se resolve sozinho: a barra de filtros é um
        `<form method="get">`, que não carrega `pagina`, então aplicar um filtro
        novo volta para a primeira página, como deve.
      */}
      <Paginacao
        meta={lancamentos.meta}
        base="/painel/financeiro"
        parametros={{ de, ate, categoriaId: categoriaId || undefined }}
      />
    </div>
  );
}

function FiltrosFinanceiros({
  de,
  ate,
  categoriaId,
  categorias,
  ativo,
}: {
  de: string;
  ate: string;
  categoriaId: string;
  categorias: CategoriaFinanceira[];
  /** A URL trouxe período ou categoria: o filtro abre já aberto. */
  ativo: boolean;
}) {
  return (
    <BarraFiltros ativo={ativo}>
      <CampoFiltro rotulo="De" type="date" name="de" defaultValue={de} />
      <CampoFiltro rotulo="Até" type="date" name="ate" defaultValue={ate} />

      <SelecaoFiltro rotulo="Categoria" name="categoriaId" defaultValue={categoriaId}>
        <option value="">Toda categoria</option>
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.nome}
          </option>
        ))}
      </SelecaoFiltro>

      <button type="submit" className={estilosBotao({ tamanho: 'sm' })}>
        Aplicar
      </button>

      <LinkLimparFiltros href="/painel/financeiro" ativo={ativo} />
    </BarraFiltros>
  );
}

/**
 * De que é feita a saída do período.
 *
 * O bloco existe por causa do terceiro pedaço: as saídas sem categoria. Elas
 * não são nem fixas nem variáveis, e antes simplesmente sumiam — os dois
 * números mostrados não somavam o total e ninguém percebia. Aqui a fatia
 * aparece, e um pedaço grande dela é o recado de que falta categorizar.
 */
function ComposicaoDasSaidas({ fluxo }: { fluxo: FluxoDeCaixa }) {
  if (Number(fluxo.saidas) <= 0) {
    return null;
  }

  const naoClassificado = Number(fluxo.custoNaoClassificado);

  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>Composição das saídas</CartaoTitulo>
        <p className="text-muted-foreground shrink-0 text-xs">
          {formatarBRL(fluxo.saidas)} no período
        </p>
      </CartaoCabecalho>

      <CartaoConteudo className="flex flex-col gap-3">
        <BarraProporcao
          formatar={(valor) => formatarBRL(valor.toFixed(2))}
          fatias={[
            { rotulo: 'Fixo', valor: Number(fluxo.custoFixo), serie: 1 },
            { rotulo: 'Variável', valor: Number(fluxo.custoVariavel), serie: 2 },
            { rotulo: 'Sem categoria', valor: naoClassificado, serie: 4 },
          ]}
        />

        {/* Os três nomes da barra são jargão para quem acabou de chegar. */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>Entenda:</span>
          <span className="inline-flex items-center gap-1.5">
            Fixo <DicaConceito conceito="custo-fixo" />
          </span>
          <span className="inline-flex items-center gap-1.5">
            Variável <DicaConceito conceito="custo-variavel" />
          </span>
          <span className="inline-flex items-center gap-1.5">
            Sem categoria <DicaConceito conceito="sem-categoria" />
          </span>
        </div>

        {naoClassificado > 0 && (
          <p className="text-muted-foreground text-xs">
            {formatarBRL(fluxo.custoNaoClassificado)} sem categoria. Enquanto estiver assim, esse
            valor não entra nem no custo fixo nem no variável,{' '}
            <Link
              href="/painel/financeiro/categorias"
              className="text-primary underline-offset-4 hover:underline"
            >
              classifique as saídas
            </Link>{' '}
            para o cálculo ficar completo.
          </p>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}
