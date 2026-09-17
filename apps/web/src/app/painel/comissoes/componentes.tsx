import Link from 'next/link';
import { BadgePercent } from 'lucide-react';
import {
  ROTULO_STATUS_COMISSAO,
  ROTULO_TIPO_COMISSAO,
  formatarBRL,
  mesCorrente,
  type Comissao,
  type PessoaEquipe,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  BarraFiltros,
  CampoFiltro,
  LinkLimparFiltros,
  SelecaoFiltro,
} from '@/components/ui/filtros';
import { Selo } from '@/components/ui/selo';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { formatarDataCurta } from '@/lib/formatacao';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Período e situação da URL, com o mês corrente como padrão. */
export function lerFiltrosComissoes(parametros: { de?: string; ate?: string; status?: string }) {
  const padrao = mesCorrente();

  return {
    de: parametros.de && DIA.test(parametros.de) ? parametros.de : padrao.de,
    ate: parametros.ate && DIA.test(parametros.ate) ? parametros.ate : padrao.ate,
    status:
      parametros.status === 'pendente' || parametros.status === 'fechada' ? parametros.status : '',
  };
}

export function FiltrosComissoes({
  de,
  ate,
  status,
  usuarioId = '',
  pessoas,
}: {
  de: string;
  ate: string;
  status: string;
  usuarioId?: string;
  /** Presente só na visão da equipe. */
  pessoas?: PessoaEquipe[];
}) {
  const padrao = mesCorrente();
  const ativo = de !== padrao.de || ate !== padrao.ate || Boolean(status) || Boolean(usuarioId);
  const rotaBase = pessoas ? '/painel/comissoes' : '/painel/minhas-comissoes';

  return (
    <BarraFiltros ativo={ativo}>
      <CampoFiltro rotulo="De" type="date" name="de" defaultValue={de} />
      <CampoFiltro rotulo="Até" type="date" name="ate" defaultValue={ate} />

      {pessoas && (
        <SelecaoFiltro rotulo="Pessoa" name="usuarioId" defaultValue={usuarioId}>
          <option value="">Toda a equipe</option>
          {pessoas.map((pessoa) => (
            <option key={pessoa.id} value={pessoa.id}>
              {pessoa.nome}
            </option>
          ))}
        </SelecaoFiltro>
      )}

      <SelecaoFiltro rotulo="Situação" name="status" defaultValue={status}>
        <option value="">Toda situação</option>
        <option value="pendente">Pendentes</option>
        <option value="fechada">Fechadas</option>
      </SelecaoFiltro>

      <button type="submit" className={estilosBotao({ tamanho: 'sm' })}>
        Aplicar
      </button>

      <LinkLimparFiltros href={rotaBase} ativo={ativo} />
    </BarraFiltros>
  );
}

export function TabelaComissoes({
  itens,
  mostrarPessoa,
  vazio,
}: {
  itens: Comissao[];
  mostrarPessoa: boolean;
  vazio: string;
}) {
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>Comissões do período</CartaoTitulo>
      </CartaoCabecalho>
      {itens.length === 0 ? (
        <CartaoConteudo>
          <EstadoVazio
            icone={BadgePercent}
            titulo="Nenhuma comissão no período"
            descricao={vazio}
            className="border-0"
          />
        </CartaoConteudo>
      ) : (
        <TabelaRolavel>
          <TabelaCabecalho>
            <TabelaColuna>Data</TabelaColuna>
            {mostrarPessoa && <TabelaColuna>Pessoa</TabelaColuna>}
            <TabelaColuna>Origem</TabelaColuna>
            <TabelaColuna>Situação</TabelaColuna>
            <TabelaColuna numerica>Base</TabelaColuna>
            <TabelaColuna numerica>%</TabelaColuna>
            <TabelaColuna numerica>Comissão</TabelaColuna>
          </TabelaCabecalho>
          <TabelaCorpo>
            {itens.map((comissao) => (
              <TabelaLinha key={comissao.id}>
                <TabelaCelula suave className="whitespace-nowrap tabular-nums">
                  {formatarDataCurta(comissao.competencia)}
                </TabelaCelula>
                {mostrarPessoa && <TabelaCelula>{comissao.usuarioNome}</TabelaCelula>}
                <TabelaCelula className="min-w-[14rem]">
                  <Link
                    href={
                      comissao.orcamentoId
                        ? `/painel/orcamentos/${comissao.orcamentoId}`
                        : `/painel/agenda/${comissao.agendamentoId}`
                    }
                    className="underline-offset-4 hover:underline"
                  >
                    {ROTULO_TIPO_COMISSAO[comissao.tipo]} · {comissao.servicoNome ?? 'Sem serviço'}
                  </Link>
                  <div className="text-muted-foreground text-xs">{comissao.clienteNome ?? '—'}</div>
                </TabelaCelula>
                <TabelaCelula>
                  <Selo tom={comissao.status === 'fechada' ? 'sucesso' : 'atencao'}>
                    {ROTULO_STATUS_COMISSAO[comissao.status]}
                  </Selo>
                </TabelaCelula>
                <TabelaCelula numerica suave>
                  {formatarBRL(comissao.base)}
                </TabelaCelula>
                <TabelaCelula numerica suave>
                  {comissao.percentual.replace('.', ',')}
                </TabelaCelula>
                <TabelaCelula numerica className="font-medium">
                  {formatarBRL(comissao.valor)}
                </TabelaCelula>
              </TabelaLinha>
            ))}
          </TabelaCorpo>
        </TabelaRolavel>
      )}
    </Cartao>
  );
}
