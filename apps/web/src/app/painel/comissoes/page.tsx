import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatarBRL, type PessoaEquipe, type RelatorioComissoes } from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoTitulo } from '@/components/ui/cartao';
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
import { formatarPeriodo } from '@/lib/formatacao';
import { BotaoFecharComissoes } from './botao-fechar';
import { FiltrosComissoes, TabelaComissoes, lerFiltrosComissoes } from './componentes';

export const metadata: Metadata = { title: 'Comissões da equipe' };

interface Props {
  searchParams: Promise<{ de?: string; ate?: string; usuarioId?: string; status?: string }>;
}

/** Visão do dono: comissões de todos, percentuais e fechamento. */
export default async function PaginaComissoes({ searchParams }: Props) {
  const usuario = await usuarioAtual();

  // Quem não é admin cai nas próprias comissões em vez de ver um erro.
  if (usuario.papel !== 'admin') {
    redirect('/painel/minhas-comissoes');
  }

  const parametros = await searchParams;
  const { de, ate, status } = lerFiltrosComissoes(parametros);
  const usuarioId = parametros.usuarioId ?? '';

  const query = new URLSearchParams({ de, ate });
  if (usuarioId) query.set('usuarioId', usuarioId);
  if (status) query.set('status', status);

  const [relatorio, pessoas] = await Promise.all([
    apiComSessao<RelatorioComissoes>(`/comissoes?${query.toString()}`),
    apiComSessao<PessoaEquipe[]>('/equipe/pessoas'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Comissões da equipe"
        descricao={`${formatarPeriodo(de, ate)} · geradas na aprovação de orçamentos e na execução de serviços.`}
        acoes={
          <Link href="/painel/equipe" className={estilosBotao({ variante: 'secundario' })}>
            Percentuais da equipe
          </Link>
        }
      />

      <FiltrosComissoes
        de={de}
        ate={ate}
        status={status}
        usuarioId={usuarioId}
        pessoas={pessoas}
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="A fechar"
          valor={formatarBRL(relatorio.totalPendente)}
          detalhe="comissões pendentes no período"
          destaque
        />
        <Indicador
          titulo="Fechadas"
          valor={formatarBRL(relatorio.totalFechado)}
          detalhe="já viraram conta a pagar"
        />
      </FaixaDeIndicadores>

      {relatorio.porPessoa.length > 0 && (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Por pessoa</CartaoTitulo>
            <p className="text-muted-foreground text-xs">
              Fechar gera uma conta a pagar na categoria Comissões.
            </p>
          </CartaoCabecalho>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Pessoa</TabelaColuna>
              <TabelaColuna numerica>Pendente</TabelaColuna>
              <TabelaColuna numerica>Fechado</TabelaColuna>
              <TabelaColuna numerica>Ação</TabelaColuna>
            </TabelaCabecalho>
            <TabelaCorpo>
              {relatorio.porPessoa.map((pessoa) => (
                <TabelaLinha key={pessoa.usuarioId}>
                  <TabelaCelula className="font-medium">{pessoa.usuarioNome}</TabelaCelula>
                  <TabelaCelula numerica>
                    {formatarBRL(pessoa.pendente)}
                    <div className="text-muted-foreground text-xs">
                      {pessoa.quantidadePendente} comissão(ões)
                    </div>
                  </TabelaCelula>
                  <TabelaCelula numerica suave>
                    {formatarBRL(pessoa.fechada)}
                  </TabelaCelula>
                  <TabelaCelula numerica>
                    {Number(pessoa.pendente) > 0 ? (
                      <BotaoFecharComissoes
                        usuarioId={pessoa.usuarioId}
                        nome={pessoa.usuarioNome}
                        valor={pessoa.pendente}
                        de={de}
                        ate={ate}
                      />
                    ) : (
                      '—'
                    )}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}

      <TabelaComissoes
        itens={relatorio.itens}
        mostrarPessoa
        vazio="Defina os percentuais de venda e de execução de cada pessoa em Equipe. As comissões nascem quando um orçamento é aprovado ou um serviço é executado."
      />
    </div>
  );
}
