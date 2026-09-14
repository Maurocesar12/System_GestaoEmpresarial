import type { Metadata } from 'next';
import Link from 'next/link';
import { HeartHandshake, MessageCircle, Phone } from 'lucide-react';
import {
  DIAS_PARA_REATIVACAO,
  formatarBRL,
  formatarTelefone,
  MOTIVOS_REATIVACAO,
  ROTULO_MOTIVO_REATIVACAO,
  SUGESTAO_MOTIVO_REATIVACAO,
  type ClienteParaReativar,
  type ListaDeReativacao,
  type MotivoReativacao,
} from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { BarraDeFiltros } from '@/components/ui/filtro-link';
import { FiltroComposto } from '@/components/ui/filtro-composto';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Paginacao } from '@/components/ui/paginacao';
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
import { linkTelefone, linkWhatsApp } from '@/lib/contato';
import { formatarDataCompleta } from '@/lib/formatacao';

export const metadata: Metadata = {
  title: 'Reativação',
};

const BASE = '/painel/reativacao';

const JANELAS = [
  { valor: '30', rotulo: '30 dias' },
  { valor: String(DIAS_PARA_REATIVACAO), rotulo: '60 dias' },
  { valor: '180', rotulo: '180 dias' },
  { valor: '365', rotulo: '1 ano' },
];

const TOM_DO_MOTIVO: Record<MotivoReativacao, 'sucesso' | 'perigo' | 'atencao' | 'neutro'> = {
  comprou_e_sumiu: 'sucesso',
  proposta_recusada: 'perigo',
  proposta_sem_resposta: 'atencao',
  nunca_fechou: 'neutro',
};

interface Props {
  searchParams: Promise<{ motivo?: string; dias?: string; pagina?: string }>;
}

/**
 * Lista de reativação.
 *
 * O cliente frio não aparece em tela nenhuma do sistema: não tem proposta
 * aberta, não tem agendamento e não tem lembrete pendente. É exatamente por
 * isso que ele some — e por isso esta tela existe.
 *
 * A fila vem ordenada por quanto o cliente já gastou, porque vender de novo
 * para quem já comprou é a venda mais barata que existe. O motivo viaja junto
 * porque ele muda a ligação: quem recusou preço merece outra condição, quem
 * comprou e sumiu merece a revisão.
 */
export default async function PaginaReativacao({ searchParams }: Props) {
  const { motivo, dias = String(DIAS_PARA_REATIVACAO), pagina = '1' } = await searchParams;

  const query = new URLSearchParams({ pagina, porPagina: '20', dias });
  if (motivo) query.set('motivo', motivo);

  const { resumo, clientes, meta } = await apiComSessao<ListaDeReativacao>(
    `/leads/reativacao?${query.toString()}`,
  );
  const filtros = { motivo, dias };
  const porMotivo = new Map(resumo.porMotivo.map((item) => [item.motivo, item.total]));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Reativação"
        descricao={`Clientes sem nenhum contato há mais de ${resumo.dias} dias, do mais valioso para o menos.`}
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="Para reativar"
          valor={String(resumo.total)}
          detalhe={
            resumo.total > resumo.analisados
              ? `${resumo.analisados} ranqueados nesta fila`
              : 'clientes frios na carteira'
          }
        />
        <Indicador
          titulo="Já compraram"
          valor={String(porMotivo.get('comprou_e_sumiu') ?? 0)}
          detalhe="a ligação que costuma valer mais"
          tom={(porMotivo.get('comprou_e_sumiu') ?? 0) > 0 ? 'positivo' : 'neutro'}
          href={`${BASE}?motivo=comprou_e_sumiu&dias=${dias}`}
        />
        <Indicador
          titulo="Histórico da fila"
          valor={formatarBRL(resumo.valorHistorico)}
          detalhe="soma do que esses clientes já fecharam"
        />
        <Indicador
          titulo="Sem resposta"
          valor={String(
            (porMotivo.get('proposta_sem_resposta') ?? 0) +
              (porMotivo.get('proposta_recusada') ?? 0),
          )}
          detalhe="receberam proposta e não avançaram"
          href={`${BASE}?motivo=proposta_sem_resposta&dias=${dias}`}
        />
      </FaixaDeIndicadores>

      <div className="flex flex-col gap-3">
        <BarraDeFiltros rotulo="Motivo">
          <FiltroComposto
            base={BASE}
            parametros={filtros}
            parametro="motivo"
            atual={motivo}
            rotulo="Todos"
          />
          {MOTIVOS_REATIVACAO.map((valor) => (
            <FiltroComposto
              key={valor}
              base={BASE}
              parametros={filtros}
              parametro="motivo"
              valor={valor}
              atual={motivo}
              rotulo={`${ROTULO_MOTIVO_REATIVACAO[valor]}${porMotivo.has(valor) ? ` · ${porMotivo.get(valor)}` : ''}`}
            />
          ))}
        </BarraDeFiltros>

        <BarraDeFiltros rotulo="Tempo sem contato">
          {JANELAS.map((janela) => (
            <FiltroComposto
              key={janela.valor}
              base={BASE}
              parametros={filtros}
              parametro="dias"
              valor={janela.valor}
              atual={dias}
              rotulo={janela.rotulo}
            />
          ))}
        </BarraDeFiltros>
      </div>

      {clientes.length === 0 ? (
        <EstadoVazio
          icone={HeartHandshake}
          titulo="Nenhum cliente para reativar"
          descricao={
            motivo
              ? 'Nenhum cliente frio com este motivo. Troque o filtro para ver os outros.'
              : `Ninguém está há mais de ${resumo.dias} dias sem contato. Aumente a janela para revisar clientes mais antigos.`
          }
        />
      ) : (
        <Cartao>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Cliente</TabelaColuna>
              <TabelaColuna>Motivo</TabelaColuna>
              <TabelaColuna>Último contato</TabelaColuna>
              <TabelaColuna>Última proposta</TabelaColuna>
              <TabelaColuna numerica>Já fechou</TabelaColuna>
              <TabelaColuna>
                <span className="sr-only">Contato</span>
              </TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {clientes.map((cliente) => (
                <LinhaDeReativacao key={cliente.id} cliente={cliente} />
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}

      <Paginacao meta={meta} base={BASE} parametros={filtros} />

      <p className="text-muted-foreground text-xs">
        O cliente sai desta lista sozinho assim que alguém registrar um atendimento, marcar um
        follow-up ou emitir uma proposta para ele.
      </p>
    </div>
  );
}

function LinhaDeReativacao({ cliente }: { cliente: ClienteParaReativar }) {
  const whatsapp = linkWhatsApp(cliente.telefone);
  const telefone = linkTelefone(cliente.telefone);

  return (
    <TabelaLinha>
      <TabelaCelula>
        <Link
          href={`/painel/clientes/${cliente.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {cliente.nome}
        </Link>
        <span className="text-muted-foreground block text-xs">
          {formatarTelefone(cliente.telefone) || cliente.email || 'sem contato cadastrado'}
        </span>
      </TabelaCelula>

      <TabelaCelula>
        <Selo tom={TOM_DO_MOTIVO[cliente.motivo]} comPonto>
          {ROTULO_MOTIVO_REATIVACAO[cliente.motivo]}
        </Selo>
        <span className="text-muted-foreground mt-1 block max-w-[22rem] text-xs">
          {SUGESTAO_MOTIVO_REATIVACAO[cliente.motivo]}
        </span>
      </TabelaCelula>

      <TabelaCelula>
        <span className="text-sm font-medium tabular-nums">{cliente.diasSemContato} dias</span>
        <span className="text-muted-foreground block text-xs">
          {cliente.ultimoContatoEm
            ? formatarDataCompleta(cliente.ultimoContatoEm.slice(0, 10))
            : 'nunca houve contato registrado'}
        </span>
      </TabelaCelula>

      <TabelaCelula>
        {cliente.ultimoOrcamento ? (
          <>
            <Link
              href={`/painel/orcamentos/${cliente.ultimoOrcamento.id}`}
              className="text-sm underline-offset-4 hover:underline"
            >
              {formatarBRL(cliente.ultimoOrcamento.valor)}
            </Link>
            <span className="text-muted-foreground block text-xs">
              {cliente.ultimoOrcamento.servicoNome ?? 'sem serviço do catálogo'}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TabelaCelula>

      <TabelaCelula numerica>
        <span className="font-medium">{formatarBRL(cliente.valorHistorico)}</span>
        <span className="text-muted-foreground block text-xs">
          {cliente.servicosFechados} serviço(s)
        </span>
      </TabelaCelula>

      <TabelaCelula>
        <div className="flex justify-end gap-1">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              aria-label={`Conversar com ${cliente.nome} no WhatsApp`}
              className={estilosBotao({ variante: 'sutil', tamanho: 'icone' })}
            >
              <MessageCircle aria-hidden />
            </a>
          )}
          {telefone && (
            <a
              href={telefone}
              aria-label={`Ligar para ${cliente.nome}`}
              className={estilosBotao({ variante: 'sutil', tamanho: 'icone' })}
            >
              <Phone aria-hidden />
            </a>
          )}
          <Link
            href={`/painel/lembretes/novo?cliente=${cliente.id}`}
            className={estilosBotao({ variante: 'secundario', tamanho: 'sm' })}
          >
            Agendar retorno
          </Link>
        </div>
      </TabelaCelula>
    </TabelaLinha>
  );
}
