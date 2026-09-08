import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, ScrollText } from 'lucide-react';
import {
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  type AcaoAuditoria,
  type EntidadeAuditoria,
  type Paginado,
  type RegistroAuditoria,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Campo } from '@/components/ui/campo';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Paginacao } from '@/components/ui/paginacao';
import { Selecao } from '@/components/ui/selecao';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = { title: 'Histórico' };

const ROTA_HISTORICO = '/painel/historico';

const ROTULO_ENTIDADE: Record<EntidadeAuditoria, string> = {
  funcionario: 'Funcionário',
  convite: 'Convite',
  cliente: 'Cliente',
  lancamento: 'Lançamento',
  pro_labore: 'Pró-labore',
  reserva: 'Reserva',
  categoria: 'Categoria',
  funil: 'Funil',
  agendamentos: 'Agendamento',
  atendimentos: 'Atendimento',
  lembretes: 'Lembrete',
  orcamentos: 'Orçamento',
  servicos: 'Serviço',
  empresa: 'Empresa',
  configuracoes: 'Configurações',
  previsao_financeira: 'Previsão financeira',
  importacao_financeira: 'Importação financeira',
};

const ROTULO_ACAO: Record<AcaoAuditoria, string> = {
  criou: 'Criou',
  alterou: 'Alterou',
  excluiu: 'Excluiu',
  movimentou: 'Movimentou',
  convidou: 'Convidou',
  desativou: 'Desativou',
};

interface Props {
  searchParams: Promise<{
    busca?: string;
    entidade?: string;
    acao?: string;
    de?: string;
    ate?: string;
    pagina?: string;
  }>;
}

export default async function PaginaHistorico({ searchParams }: Props) {
  const filtros = await searchParams;
  const query = new URLSearchParams({ pagina: filtros.pagina ?? '1', porPagina: '30' });

  for (const chave of ['busca', 'entidade', 'acao', 'de', 'ate'] as const) {
    if (filtros[chave]) query.set(chave, filtros[chave]);
  }

  const { dados: registros, meta } = await apiComSessao<Paginado<RegistroAuditoria>>(
    `/auditoria?${query.toString()}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Histórico"
        descricao="Busque alterações antigas, clientes excluídos e movimentos financeiros."
      />

      <Filtros filtros={filtros} />

      {registros.length === 0 ? (
        <EstadoVazio
          icone={ScrollText}
          titulo="Nenhum histórico encontrado"
          descricao="Ajuste os filtros ou pesquise por outro nome, valor, descrição ou período."
        />
      ) : (
        <>
          <Cartao>
            <TabelaRolavel>
              <TabelaCabecalho>
                <TabelaColuna>Data</TabelaColuna>
                <TabelaColuna>Responsável</TabelaColuna>
                <TabelaColuna>Ação</TabelaColuna>
                <TabelaColuna>Registro</TabelaColuna>
                <TabelaColuna>Resumo</TabelaColuna>
              </TabelaCabecalho>
              <TabelaCorpo>
                {registros.map((registro) => (
                  <TabelaLinha key={registro.id}>
                    <TabelaCelula suave className="whitespace-nowrap">
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(registro.criadoEm))}
                    </TabelaCelula>
                    <TabelaCelula>{registro.usuarioNome}</TabelaCelula>
                    <TabelaCelula>{rotularAcao(registro.acao)}</TabelaCelula>
                    <TabelaCelula>{rotularEntidade(registro.entidade)}</TabelaCelula>
                    <TabelaCelula className="min-w-[20rem]">
                      <span className="line-clamp-2">{registro.resumo}</span>
                    </TabelaCelula>
                  </TabelaLinha>
                ))}
              </TabelaCorpo>
            </TabelaRolavel>
          </Cartao>

          <Paginacao
            meta={meta}
            base={ROTA_HISTORICO}
            parametros={{
              busca: filtros.busca,
              entidade: filtros.entidade,
              acao: filtros.acao,
              de: filtros.de,
              ate: filtros.ate,
            }}
          />
        </>
      )}
    </div>
  );
}

function Filtros({ filtros }: { filtros: Awaited<Props['searchParams']> }) {
  return (
    <form className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_10rem_10rem_auto]">
      <Campo
        rotulo="Buscar"
        name="busca"
        defaultValue={filtros.busca}
        placeholder="cliente, salário, valor, descrição..."
      />

      <Selecao rotulo="Registro" name="entidade" defaultValue={filtros.entidade ?? ''}>
        <option value="">Todos</option>
        {ENTIDADES_AUDITORIA.map((entidade) => (
          <option key={entidade} value={entidade}>
            {ROTULO_ENTIDADE[entidade]}
          </option>
        ))}
      </Selecao>

      <Selecao rotulo="Ação" name="acao" defaultValue={filtros.acao ?? ''}>
        <option value="">Todas</option>
        {ACOES_AUDITORIA.map((acao) => (
          <option key={acao} value={acao}>
            {ROTULO_ACAO[acao]}
          </option>
        ))}
      </Selecao>

      <Campo rotulo="De" type="date" name="de" defaultValue={filtros.de} />
      <Campo rotulo="Até" type="date" name="ate" defaultValue={filtros.ate} />

      <div className="flex items-end gap-2">
        <button type="submit" className={estilosBotao()}>
          <Search aria-hidden />
          Buscar
        </button>

        <Link href={ROTA_HISTORICO} className={estilosBotao({ variante: 'secundario' })}>
          Limpar
        </Link>
      </div>
    </form>
  );
}

function rotularEntidade(entidade: string): string {
  return entidade in ROTULO_ENTIDADE
    ? ROTULO_ENTIDADE[entidade as EntidadeAuditoria]
    : entidade.replace(/_/g, ' ');
}

function rotularAcao(acao: string): string {
  return acao in ROTULO_ACAO ? ROTULO_ACAO[acao as AcaoAuditoria] : acao;
}
