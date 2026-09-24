import type { Metadata } from 'next';
import { Megaphone } from 'lucide-react';
import {
  formatarBRL,
  mesCorrente,
  possuiPermissao,
  type ChaveMarketing,
  type RelatorioMarketing,
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
  const padrao = mesCorrente();
  const de = parametros.de ?? padrao.de;
  const ate = parametros.ate ?? padrao.ate;
  const periodo = new URLSearchParams({ de, ate }).toString();

  const [relatorio, chave, usuario] = await Promise.all([
    apiComSessao<RelatorioMarketing>(`/marketing/relatorio?${periodo}`),
    apiComSessao<ChaveMarketing>('/marketing/chave'),
    usuarioAtual(),
  ]);

  const ativo = de !== padrao.de || ate !== padrao.ate;
  const melhor = relatorio.origens[0];
  const convertidos = relatorio.origens.reduce((soma, item) => soma + item.convertidos, 0);
  const maiorVolume = Math.max(...relatorio.origens.map((item) => item.leads), 0);
  const maiorEtapa = Math.max(...relatorio.etapas.map((item) => item.clientes), 0);

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
          valor={String(convertidos)}
          detalhe="com orçamento aprovado"
          tom={convertidos > 0 ? 'positivo' : undefined}
        />
        <Indicador
          titulo="Origem que mais traz"
          valor={melhor?.origem ?? '—'}
          detalhe={melhor ? `${melhor.leads} lead(s)` : 'nenhum lead no período'}
        />
      </FaixaDeIndicadores>

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
          <CartaoTitulo>Onde os clientes estão no funil</CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">Posição de hoje, não do período.</p>
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

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Formulário para o seu site</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <FormularioEmbed
            chave={chave.chave}
            urlApi={env.NEXT_PUBLIC_API_URL}
            podeGerar={possuiPermissao(usuario, 'marketing.gerenciar')}
          />
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
