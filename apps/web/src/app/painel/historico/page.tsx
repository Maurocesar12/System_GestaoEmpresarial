import type { Metadata } from 'next';
import { Search, ScrollText } from 'lucide-react';
import {
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  type AcaoAuditoria,
  type EntidadeAuditoria,
  type Paginado,
  type RegistroAuditoria,
} from '@gestao/shared-types';
import { unstable_rethrow } from 'next/navigation';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  BarraFiltros,
  CampoFiltro,
  LinkLimparFiltros,
  SelecaoFiltro,
} from '@/components/ui/filtros';
import { Paginacao } from '@/components/ui/paginacao';
import { ApiRequestError } from '@/lib/api';
import { apiComSessao } from '@/lib/api-servidor';
import { lerUsuarioDaSessao } from '@/lib/sessao';
import { TabelaHistorico } from './tabela-historico';

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
  auditoria: 'Histórico',
  previsao_financeira: 'Previsão financeira',
  importacao_financeira: 'Importação financeira',
  material: 'Material',
  comissao: 'Comissão',
};

const ROTULO_ACAO: Record<AcaoAuditoria, string> = {
  criou: 'Criou',
  alterou: 'Alterou',
  excluiu: 'Excluiu',
  movimentou: 'Movimentou',
  convidou: 'Convidou',
  desativou: 'Desativou',
  anonimizou: 'Anonimizou',
  exportou: 'Exportou',
  cancelou: 'Cancelou',
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

  const [historico, usuario] = await Promise.all([carregarHistorico(query), lerUsuarioDaSessao()]);

  // Excluir histórico é do administrador, e não uma permissão que se conceda a
  // um funcionário — a API recusa qualquer outro papel. Esta checagem existe só
  // para não oferecer uma ação que terminaria em "sem permissão".
  const podeExcluir = usuario?.papel === 'admin';

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Histórico"
        descricao="Busque alterações antigas, clientes excluídos e movimentos financeiros."
      />

      <Filtros filtros={filtros} />

      <ConteudoHistorico historico={historico} filtros={filtros} podeExcluir={podeExcluir} />
    </div>
  );
}

async function carregarHistorico(query: URLSearchParams): Promise<
  | {
      sucesso: true;
      registros: RegistroAuditoria[];
      meta: Paginado<RegistroAuditoria>['meta'];
    }
  | { sucesso: false; erro: string }
> {
  try {
    const { dados, meta } = await apiComSessao<Paginado<RegistroAuditoria>>(
      `/auditoria?${query.toString()}`,
    );

    return { sucesso: true, registros: dados, meta };
  } catch (erro) {
    unstable_rethrow(erro);

    return {
      sucesso: false,
      erro: mensagemDaApi(erro, 'Não foi possível carregar o histórico agora.'),
    };
  }
}

function ConteudoHistorico({
  filtros,
  historico,
  podeExcluir,
}: {
  filtros: Awaited<Props['searchParams']>;
  historico: Awaited<ReturnType<typeof carregarHistorico>>;
  podeExcluir: boolean;
}) {
  if (!historico.sucesso) return <AvisoErro mensagem={historico.erro} />;

  if (historico.registros.length === 0) {
    return (
      <EstadoVazio
        icone={ScrollText}
        titulo="Nenhum histórico encontrado"
        descricao="Ajuste os filtros ou pesquise por outro nome, valor, descrição ou período."
      />
    );
  }

  return (
    <>
      <TabelaHistorico
        registros={historico.registros.map(mapearLinhaHistorico)}
        podeExcluir={podeExcluir}
      />

      <Paginacao
        meta={historico.meta}
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
  );
}

function mapearLinhaHistorico(registro: RegistroAuditoria) {
  return {
    id: registro.id,
    data: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(registro.criadoEm)),
    responsavel: registro.usuarioNome,
    acao: rotularAcao(registro.acao),
    registro: rotularEntidade(registro.entidade),
    resumo: registro.resumo,
  };
}

function Filtros({ filtros }: { filtros: Awaited<Props['searchParams']> }) {
  const ativo = Boolean(
    filtros.busca || filtros.entidade || filtros.acao || filtros.de || filtros.ate,
  );

  return (
    <BarraFiltros ativo={ativo}>
      <CampoFiltro
        rotulo="Buscar"
        name="busca"
        defaultValue={filtros.busca}
        placeholder="Nome, valor, descrição…"
        className="min-w-0 flex-1 sm:min-w-64"
      />

      <SelecaoFiltro rotulo="Registro" name="entidade" defaultValue={filtros.entidade ?? ''}>
        <option value="">Todo registro</option>
        {ENTIDADES_AUDITORIA.map((entidade) => (
          <option key={entidade} value={entidade}>
            {ROTULO_ENTIDADE[entidade]}
          </option>
        ))}
      </SelecaoFiltro>

      <SelecaoFiltro rotulo="Ação" name="acao" defaultValue={filtros.acao ?? ''}>
        <option value="">Toda ação</option>
        {ACOES_AUDITORIA.map((acao) => (
          <option key={acao} value={acao}>
            {ROTULO_ACAO[acao]}
          </option>
        ))}
      </SelecaoFiltro>

      <CampoFiltro rotulo="De" type="date" name="de" defaultValue={filtros.de} />
      <CampoFiltro rotulo="Até" type="date" name="ate" defaultValue={filtros.ate} />

      <button type="submit" className={estilosBotao({ tamanho: 'sm' })}>
        <Search aria-hidden className="size-4" />
        Buscar
      </button>

      <LinkLimparFiltros href={ROTA_HISTORICO} ativo={ativo} />
    </BarraFiltros>
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

function mensagemDaApi(erro: unknown, fallback: string): string {
  return erro instanceof ApiRequestError ? erro.message : fallback;
}
