import type { Metadata } from 'next';
import {
  formatarBRL,
  LIMITE_PREVISOES_IA_GRATUITAS_MENSAIS,
  type ConsumoIaResponse,
  type PlanoCatalogo,
  type PlanoAtualResponse,
  type PlanosCatalogoResponse,
} from '@gestao/shared-types';
import { Check } from 'lucide-react';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = { title: 'Plano e consumo' };

export default async function PaginaPlano() {
  const [atual, catalogo, consumo] = await Promise.all([
    apiComSessao<PlanoAtualResponse>('/planos/atual'),
    apiComSessao<PlanosCatalogoResponse>('/planos/catalogo'),
    apiComSessao<ConsumoIaResponse>('/ia/consumo'),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Plano e consumo"
        descricao="Limites da empresa e uso mensal em um só lugar."
      />
      <Cartao>
        <CartaoCabecalho>
          <div>
            <CartaoTitulo>Plano {atual.plano.nome}</CartaoTitulo>
            <p className="text-muted-foreground mt-1 text-xs">
              Base de {formatarBRL(atual.cobranca.precoBase)} por mês
            </p>
          </div>
          <Selo tom={atual.assinatura.status === 'ativo' ? 'sucesso' : 'atencao'}>
            {atual.assinatura.status}
          </Selo>
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Uso rotulo="Usuários" usado={atual.uso.usuarios} limite={atual.limites.usuarios} />
          <Uso rotulo="Clientes" usado={atual.uso.clientes} limite={atual.limites.clientes} />
          <Uso
            rotulo="Previsões neste mês"
            usado={atual.uso.previsoesIaNoMes}
            limite={atual.limites.previsoesIaMensais}
          />
          <div>
            <p className="text-muted-foreground text-xs">Mensalidade estimada</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatarBRL(atual.cobranca.mensalidadeEstimada)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {atual.cobranca.usuariosAdicionais === 0
                ? `${atual.cobranca.usuariosInclusos ?? 'Todos os'} usuários incluídos`
                : `${atual.cobranca.usuariosAdicionais} adicionais · ${formatarBRL(atual.cobranca.adicionalUsuarios)}`}
            </p>
          </div>
        </CartaoConteudo>
      </Cartao>
      <div className="grid gap-4 lg:grid-cols-2">
        {catalogo.planos.map((plano) => (
          <Plano key={plano.slug} plano={plano} atual={atual.plano.slug === plano.slug} />
        ))}
      </div>
      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Consumo de IA por usuário</CartaoTitulo>
          <span className="text-muted-foreground text-xs">
            US$ {consumo.custoEstimadoUsd} no mês
          </span>
        </CartaoCabecalho>
        <CartaoConteudo>
          {consumo.porUsuario.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma previsão gerada neste mês.</p>
          ) : (
            <ul className="divide-y">
              {consumo.porUsuario.map((item) => (
                <li
                  key={item.usuarioId}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{item.usuarioNome}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.previsoes} previsões · {item.inputTokens + item.outputTokens} tokens
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    US$ {item.custoEstimadoUsd}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CartaoConteudo>
      </Cartao>
      <p className="text-muted-foreground text-sm">
        A troca automática e a cobrança serão habilitadas quando a conta do meio de pagamento for
        conectada. Convites pendentes não são cobrados; um usuário entra na estimativa somente ao
        aceitar o convite e ficar ativo. Até lá, nenhum botão desta tela gera cobrança.
      </p>
    </div>
  );
}

function Uso({ rotulo, usado, limite }: { rotulo: string; usado: number; limite: number | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {usado}{' '}
        <span className="text-muted-foreground text-sm font-normal">
          / {limite ?? 'sem limite'}
        </span>
      </p>
    </div>
  );
}

function Plano({
  plano,
  atual,
}: {
  plano: PlanoCatalogo;
  atual: boolean;
}) {
  return (
    <Cartao className={plano.destaque ? 'ring-primary/25 ring-1' : undefined}>
      <CartaoConteudo className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{plano.nome}</h2>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">{plano.descricao}</p>
            <p className="mt-1">
              <span className="text-3xl font-semibold">{formatarBRL(plano.preco)}</span>
              <span className="text-muted-foreground text-sm">/mês</span>
            </p>
          </div>
          {atual && <Selo tom="sucesso">Plano atual</Selo>}
        </div>
        <ul className="flex flex-col gap-2">
          {itensDoPlano(plano).map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <Check className="text-primary size-4 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CartaoConteudo>
    </Cartao>
  );
}

function itensDoPlano(plano: PlanoCatalogo): string[] {
  const previsoes =
    plano.limitePrevisoesIaMensais ??
    (plano.iaHabilitada ? 'previsões sem limite definido' : LIMITE_PREVISOES_IA_GRATUITAS_MENSAIS);

  return [
    plano.usuariosInclusos === null
      ? 'Usuários incluídos sem franquia definida'
      : `${plano.usuariosInclusos} usuários incluídos`,
    plano.limiteUsuarios === null ? 'Usuários sem limite definido' : `Até ${plano.limiteUsuarios} usuários`,
    `${formatarBRL(plano.precoUsuarioAdicional)} por usuário ativo adicional`,
    plano.limiteClientes === null ? 'Clientes sem limite definido' : `${plano.limiteClientes.toLocaleString('pt-BR')} clientes`,
    'CRM, funil, agenda, financeiro e histórico',
    plano.iaHabilitada
      ? `${previsoes} previsões financeiras com IA por mês`
      : `${previsoes} previsões gratuitas com IA por mês`,
  ];
}
