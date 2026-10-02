import type { Metadata } from 'next';
import { Megaphone } from 'lucide-react';
import {
  formatarBRL,
  type ChaveMarketing,
  type RelatorioMarketing,
  type SerieDeLeads,
} from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraFiltros, CampoFiltro, LinkLimparFiltros } from '@/components/ui/filtros';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { BarraMagnitude } from '@/components/ui/barra-proporcao';
import { Selo } from '@/components/ui/selo';
import { estilosBotao } from '@/components/ui/botao';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao, usuarioAtual } from '@/lib/api-servidor';
import { env } from '@/lib/env';
import { formatarPeriodo } from '@/lib/formatacao';
import { pode } from '@/lib/permissoes';
import { FormularioEmbed } from './formulario-embed';

export const metadata: Metadata = { title: 'Marketing' };

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

/**
 * Marketing — beta (arquitetura §8.3).
 *
 * Responde duas perguntas e para por aí: **de onde vêm os leads** e **onde
 * eles travam**. O escopo é mínimo de propósito — enquanto o módulo é beta e
 * está fora dos planos pagos, ele pode mudar ou sair sem quebrar promessa
 * comercial.
 */
export default async function PaginaMarketing({ searchParams }: Props) {
  const parametros = await searchParams;

  // Repassa só as datas que vieram: sem elas, a API usa o mês corrente (em
  // São Paulo) e devolve o período que usou.
  const consulta = new URLSearchParams();
  if (parametros.de) consulta.set('de', parametros.de);
  if (parametros.ate) consulta.set('ate', parametros.ate);

  const [relatorio, chave, usuario] = await Promise.all([
    apiComSessao<RelatorioMarketing>(`/marketing/relatorio?${consulta.toString()}`),
    apiComSessao<ChaveMarketing>('/marketing/chave'),
    usuarioAtual(),
  ]);

  const { de, ate } = relatorio.periodo;
  const ativo = consulta.size > 0;
  const melhor = relatorio.origens[0];
  // Só a escala das barras: o maior valor de cada lista vira 100% da largura.
  const maiorVolume = Math.max(...relatorio.origens.map((item) => item.leads), 0);
  const maiorCampanha = Math.max(...relatorio.campanhas.map((item) => item.leads), 0);
  const maiorEtapa = Math.max(...relatorio.etapas.map((item) => item.clientes), 0);

  const taxaGeral = relatorio.taxaConversao;

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Marketing"
        descricao={`${formatarPeriodo(de, ate)} · de onde vêm os leads e onde eles param.`}
        acoes={<Selo tom="atencao">Beta</Selo>}
      />

      <BarraFiltros ativo={ativo}>
        <CampoFiltro rotulo="De" type="date" name="de" defaultValue={de} />
        <CampoFiltro rotulo="Até" type="date" name="ate" defaultValue={ate} />
        <button type="submit" className={estilosBotao({ tamanho: 'sm' })}>
          Aplicar
        </button>
        <LinkLimparFiltros href="/painel/marketing" ativo={ativo} />
      </BarraFiltros>

      <FaixaDeIndicadores>
        <Indicador titulo="Leads no período" valor={String(relatorio.totalLeads)} />
        <Indicador
          titulo="Viraram venda"
          valor={String(relatorio.totalConvertidos)}
          detalhe={`${(taxaGeral * 100).toFixed(0)}% de conversão`}
          tom={relatorio.totalConvertidos > 0 ? 'positivo' : undefined}
        />
        <Indicador
          titulo="Receita gerada"
          valor={formatarBRL(relatorio.receitaTotal)}
          detalhe="orçamentos aprovados destes leads"
          destaque
        />
        <Indicador
          titulo="Origem que mais traz"
          valor={melhor?.origem ?? '—'}
          detalhe={melhor ? `${melhor.leads} lead(s)` : 'nenhum lead no período'}
        />
      </FaixaDeIndicadores>

      <SerieDeLeadsCartao serie={relatorio.serie} />

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Leads por origem</CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">
            Conversão é orçamento aprovado, não posição no funil.
          </p>
        </CartaoCabecalho>

        {relatorio.origens.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={Megaphone}
              titulo="Nenhum lead no período"
              descricao="Preencha a origem ao cadastrar um cliente, ou use o formulário do site — é o que faz este relatório valer alguma coisa."
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Origem</TabelaColuna>
              <TabelaColuna numerica>Leads</TabelaColuna>
              <TabelaColuna numerica>Viraram venda</TabelaColuna>
              <TabelaColuna numerica>Conversão</TabelaColuna>
              <TabelaColuna numerica>Até fechar</TabelaColuna>
              <TabelaColuna numerica>Receita</TabelaColuna>
            </TabelaCabecalho>
            <TabelaCorpo>
              {relatorio.origens.map((item) => (
                <TabelaLinha key={item.origem ?? 'sem-origem'}>
                  <TabelaCelula className="min-w-56">
                    {item.origem ?? (
                      <span className="text-muted-foreground italic">sem origem</span>
                    )}
                    <BarraMagnitude valor={item.leads} maximo={maiorVolume} />
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {item.leads}
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {item.convertidos}
                  </TabelaCelula>
                  <TabelaCelula numerica className="font-medium">
                    {(item.taxaConversao * 100).toFixed(0).replace('.', ',')}%
                  </TabelaCelula>
                  <TabelaCelula numerica suave className="whitespace-nowrap">
                    <PrazoAteFechar dias={item.diasAteConversao} />
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {formatarBRL(item.receita)}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Campanhas</CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">
            Pelos parâmetros <code className="text-[0.6875rem]">utm_*</code> do link.
          </p>
        </CartaoCabecalho>

        {relatorio.campanhas.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={Megaphone}
              titulo="Nenhuma campanha identificada no período"
              descricao="Marque os links dos seus anúncios com utm_source, utm_medium e utm_campaign. Quem chegar por eles aparece aqui, separado por anúncio."
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Campanha</TabelaColuna>
              <TabelaColuna numerica>Leads</TabelaColuna>
              <TabelaColuna numerica>Viraram venda</TabelaColuna>
              <TabelaColuna numerica>Conversão</TabelaColuna>
              <TabelaColuna numerica>Até fechar</TabelaColuna>
              <TabelaColuna numerica>Receita</TabelaColuna>
            </TabelaCabecalho>
            <TabelaCorpo>
              {relatorio.campanhas.map((item) => (
                <TabelaLinha key={`${item.utmSource}|${item.utmMedium}|${item.utmCampaign}`}>
                  <TabelaCelula className="min-w-56">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {item.utmCampaign ?? (
                          <span className="text-muted-foreground italic">sem campanha</span>
                        )}
                      </span>
                      {/* Fonte e meio ficam embaixo do nome: a mesma campanha
                          aparece uma vez por canal, e sem isso duas linhas
                          idênticas pareceriam duplicata. */}
                      <span className="text-muted-foreground text-xs">
                        {[item.utmSource, item.utmMedium].filter(Boolean).join(' · ') || '—'}
                      </span>
                      <BarraMagnitude valor={item.leads} maximo={maiorCampanha} />
                    </div>
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {item.leads}
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {item.convertidos}
                  </TabelaCelula>
                  <TabelaCelula numerica className="font-medium">
                    {(item.taxaConversao * 100).toFixed(0)}%
                  </TabelaCelula>
                  <TabelaCelula numerica suave className="whitespace-nowrap">
                    <PrazoAteFechar dias={item.diasAteConversao} />
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {formatarBRL(item.receita)}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Onde estão os leads do período</CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">
            Só quem entrou neste período, na posição de hoje.
          </p>
        </CartaoCabecalho>
        <CartaoConteudo className="flex flex-col gap-3">
          {relatorio.etapas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma etapa configurada no funil.</p>
          ) : (
            relatorio.etapas.map((etapa) => (
              <div key={etapa.etapaId} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-sm">{etapa.etapa}</span>
                <div className="min-w-0 flex-1">
                  <BarraMagnitude valor={etapa.clientes} maximo={maiorEtapa} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums">
                  {etapa.clientes}
                </span>
              </div>
            ))
          )}
        </CartaoConteudo>
      </Cartao>

      {/*
        Recolhido por padrão.

        Aberto, é o maior bloco da tela: a chave, o aviso de revogação e um
        trecho de HTML que ocupa dezenas de linhas. É também o único que se usa
        uma vez e não se revisita — quem já colou o formulário no site não
        precisa dele empurrando o relatório para baixo todo dia.

        `<details>` nativo, como no resto do sistema: funciona sem JavaScript,
        responde ao teclado e mantém esta tela como Server Component.

        A situação fica no resumo de propósito, para não ser preciso abrir só
        para descobrir se o formulário está no ar.
      */}
      <Cartao>
        <details>
          <summary className="cursor-pointer px-4 py-3">
            {/* `inline` no título: o `<summary>` precisa continuar `list-item`
                para o navegador desenhar o triângulo, e um `h2` em bloco
                empurraria o texto para a linha de baixo. Segue sendo um
                cabeçalho de verdade, que o leitor de tela encontra na navegação
                por títulos. */}
            <h2 className="inline text-sm font-semibold tracking-tight">
              Formulário para o seu site
            </h2>
            <span className="text-muted-foreground ml-2 text-xs">
              {chave.chave ? 'ativo' : 'não configurado'}
            </span>
          </summary>

          <div className="border-t px-4 py-4">
            <FormularioEmbed
              chave={chave.chave}
              urlApi={env.NEXT_PUBLIC_API_URL}
              podeGerar={pode(usuario, 'marketing.gerenciar')}
            />
          </div>
        </details>
      </Cartao>
    </div>
  );
}

/**
 * Quantos dias o lead leva para virar venda.
 *
 * É o número que separa duas origens com a mesma taxa de conversão: indicação
 * que fecha em três dias e anúncio que fecha em quarenta pedem decisões
 * diferentes de caixa e de atendimento.
 *
 * O travessão significa "ainda não fechou ninguém", e não "fechou em zero dia"
 * — por isso a API manda `null` em vez de `0`.
 */
function PrazoAteFechar({ dias }: { dias: number | null }) {
  if (dias === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (dias === 0) {
    return <>no mesmo dia</>;
  }

  return <>{dias === 1 ? '1 dia' : `${dias} dias`}</>;
}

/**
 * A entrada de leads ao longo do período.
 *
 * Um total sozinho não diz se o marketing está funcionando: "80 leads no mês" é
 * ótimo se o anterior teve 40 e ruim se teve 160. Aqui a direção fica visível.
 *
 * As barras incluem os pontos de valor zero, que é o que a série existe para
 * mostrar — uma semana sem nenhum lead é informação, não ausência dela.
 */
function SerieDeLeadsCartao({ serie }: { serie: SerieDeLeads }) {
  const maximo = Math.max(...serie.pontos.map((ponto) => ponto.leads), 0);
  const totalConvertidos = serie.pontos.reduce((soma, ponto) => soma + ponto.convertidos, 0);

  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>Entrada de leads</CartaoTitulo>
        <p className="text-muted-foreground shrink-0 text-xs">
          {serie.granularidade === 'dia' ? 'Por dia' : 'Por mês'}
          {totalConvertidos > 0 && ' · a parte escura já virou venda'}
        </p>
      </CartaoCabecalho>

      <CartaoConteudo>
        {maximo === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum lead entrou neste período.</p>
        ) : (
          <div
            className="flex items-end gap-px overflow-x-auto"
            role="img"
            aria-label={`Entrada de leads ${serie.granularidade === 'dia' ? 'por dia' : 'por mês'} no período`}
          >
            {serie.pontos.map((ponto) => (
              <BarraDaSerie key={ponto.quando} ponto={ponto} maximo={maximo} />
            ))}
          </div>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

function BarraDaSerie({
  ponto,
  maximo,
}: {
  ponto: SerieDeLeads['pontos'][number];
  maximo: number;
}) {
  const altura = maximo === 0 ? 0 : (ponto.leads / maximo) * 100;

  // A fatia convertida é desenhada dentro da barra, e não ao lado: converter é
  // um subconjunto de entrar, e duas barras lado a lado sugeririam que são
  // grandezas somáveis.
  const fatiaConvertida = ponto.leads === 0 ? 0 : (ponto.convertidos / ponto.leads) * 100;

  const rotulo = [
    ponto.quando,
    ponto.leads === 1 ? '1 lead' : `${ponto.leads} leads`,
    ponto.convertidos > 0 ? `${ponto.convertidos} virou venda` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span title={rotulo} className="group/barra flex h-24 min-w-1.5 flex-1 flex-col justify-end">
      {/* Altura mínima nas barras com valor: uma barra de 1 lead num período
          cujo pico é 40 sairia com menos de um pixel e pareceria vazia. */}
      <span
        className="bg-grafico-1/30 relative flex w-full flex-col justify-end rounded-t-[2px] transition-colors group-hover/barra:bg-grafico-1/50"
        style={{ height: ponto.leads === 0 ? '2px' : `max(${altura}%, 6%)` }}
      >
        <span
          className="bg-grafico-1 w-full rounded-t-[2px]"
          style={{ height: `${fatiaConvertida}%` }}
        />
      </span>
    </span>
  );
}
