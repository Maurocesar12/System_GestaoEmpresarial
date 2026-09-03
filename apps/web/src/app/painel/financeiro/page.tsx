import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt, TrendingUp } from 'lucide-react';
import {
  ROTULO_NATUREZA,
  ROTULO_STATUS_LANCAMENTO,
  ROTULO_TIPO_LANCAMENTO,
  formatarBRL,
  mesCorrente,
  type FluxoDeCaixa,
  type Lancamento,
  type Paginado,
  type RelatorioMargem,
  type ResumoContas,
} from '@gestao/shared-types';
import { BarraMagnitude, BarraProporcao } from '@/components/ui/barra-proporcao';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
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

export const metadata: Metadata = {
  title: 'Financeiro',
};

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

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
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
  const padrao = mesCorrente();
  const de = parametros.de ?? padrao.de;
  const ate = parametros.ate ?? padrao.ate;

  const periodo = `de=${de}&ate=${ate}`;

  // As contas em aberto são buscadas em duas chamadas porque o filtro da API
  // aceita uma situação por vez.
  //
  // `natureza=empresa` nas duas não é detalhe: o cartão de resumo é calculado
  // só sobre a empresa, e sem este filtro a lista trazia também as contas
  // pessoais — uma conta aparecia na lista e não entrava no total logo acima.
  const [fluxo, margem, lancamentos, resumo, atrasadas, aVencer] = await Promise.all([
    apiComSessao<FluxoDeCaixa>(`/financeiro/fluxo-de-caixa?${periodo}`),
    apiComSessao<RelatorioMargem>(`/financeiro/margem?${periodo}`),
    apiComSessao<Paginado<Lancamento>>(`/financeiro/lancamentos?${periodo}&porPagina=20`),
    apiComSessao<ResumoContas>('/financeiro/contas/resumo'),
    apiComSessao<Paginado<Lancamento>>(
      '/financeiro/lancamentos?status=atrasado&natureza=empresa&porPagina=10',
    ),
    apiComSessao<Paginado<Lancamento>>(
      '/financeiro/lancamentos?status=a_vencer&natureza=empresa&porPagina=10',
    ),
  ]);

  const contasEmAberto = [...atrasadas.dados, ...aVencer.dados];
  const saldoNegativo = Number(fluxo.saldo) < 0;

  // A maior receita da lista dá a escala das barras da tabela de margem. Sem um
  // teto comum, cada linha se compararia consigo mesma e a coluna deixaria de
  // ser comparável de cima a baixo.
  const maiorReceita = Math.max(...margem.itens.map((item) => Number(item.receita)), 0);

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Financeiro"
        descricao={`${formatarPeriodo(de, ate)} · valores da empresa, sem os pessoais.`}
        acoes={
          <>
            <Link
              href="/painel/financeiro/dados"
              className={estilosBotao({ variante: 'secundario' })}
            >
              Importar / exportar
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

      <FaixaDeIndicadores>
        <Indicador titulo="Entradas" valor={formatarBRL(fluxo.entradas)} tom="positivo" />
        <Indicador titulo="Saídas" valor={formatarBRL(fluxo.saidas)} tom="negativo" />
        <Indicador
          titulo="Saldo"
          valor={formatarBRL(fluxo.saldo)}
          tom={saldoNegativo ? 'negativo' : 'positivo'}
          detalhe={saldoNegativo ? 'saiu mais do que entrou' : 'sobrou no período'}
          destaque
        />
        <Indicador
          titulo="Custo fixo"
          valor={formatarBRL(fluxo.custoFixo)}
          detalhe="o que custa igual todo mês"
        />
      </FaixaDeIndicadores>

      <ComposicaoDasSaidas fluxo={fluxo} />

      <SecaoContas resumo={resumo} contas={contasEmAberto} />

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2">
            <TrendingUp aria-hidden className="text-muted-foreground size-4" />
            Margem por serviço
          </CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">Receita menos custo direto.</p>
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
                <TabelaColuna numerica>%</TabelaColuna>
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
          <CartaoTitulo className="flex items-center gap-2">
            <Receipt aria-hidden className="text-muted-foreground size-4" />
            Lançamentos do período
          </CartaoTitulo>
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
    </div>
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

        {naoClassificado > 0 && (
          <p className="text-muted-foreground text-xs">
            {formatarBRL(fluxo.custoNaoClassificado)} sem categoria. Enquanto estiver assim, esse
            valor não entra nem no custo fixo nem no variável —{' '}
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
