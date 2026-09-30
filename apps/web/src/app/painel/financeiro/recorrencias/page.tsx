import type { Metadata } from 'next';
import {
  DIAS_DE_ANTECEDENCIA_RECORRENCIA,
  formatarBRL,
  somarDinheiro,
  type CategoriaFinanceira,
  type Cliente,
  type LancamentoRecorrente,
  type Paginado,
  type Servico,
} from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { apiComSessao } from '@/lib/api-servidor';
import { GerenciadorRecorrencias } from './gerenciador-recorrencias';

export const metadata: Metadata = {
  title: 'Lançamentos recorrentes',
};

/**
 * Lançamentos recorrentes.
 *
 * O que o sistema precisa saber uma vez para não perguntar todo mês: aluguel,
 * salário, internet, contador, mensalidade de software.
 *
 * A tela mostra o **compromisso mensal** no topo porque é o número que ninguém
 * tem de cabeça: a soma do que sai todo mês antes de qualquer venda acontecer.
 */
export default async function PaginaRecorrencias() {
  const [recorrencias, categorias, servicos, clientes] = await Promise.all([
    apiComSessao<LancamentoRecorrente[]>('/financeiro/recorrencias'),
    apiComSessao<CategoriaFinanceira[]>('/financeiro/categorias'),
    apiComSessao<Paginado<Servico>>('/servicos?porPagina=100&somenteAtivos=true'),
    apiComSessao<Paginado<Cliente>>('/clientes?porPagina=100'),
  ]);

  const ativas = recorrencias.filter((recorrencia) => recorrencia.ativo);

  // Só as mensais entram no compromisso mensal. Somar uma anual junto
  // multiplicaria por doze o peso de um seguro no mês — e o número existe
  // justamente para dizer quanto sai **por mês**.
  const mensais = ativas.filter((recorrencia) => recorrencia.periodicidade === 'mensal');
  const saidaMensal = somarDinheiro(
    mensais.filter((r) => r.tipo === 'saida').map((r) => r.valor),
  );
  const entradaMensal = somarDinheiro(
    mensais.filter((r) => r.tipo === 'entrada').map((r) => r.valor),
  );

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Lançamentos recorrentes"
        descricao="O que repete todo mês, cadastrado uma vez."
        voltar={{ href: '/painel/financeiro', rotulo: 'Financeiro' }}
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="Sai todo mês"
          valor={formatarBRL(saidaMensal)}
          tom="negativo"
          detalhe="antes de qualquer venda acontecer"
          destaque
        />
        <Indicador
          titulo="Entra todo mês"
          valor={formatarBRL(entradaMensal)}
          tom="positivo"
          detalhe="mensalidades e contratos"
        />
        <Indicador
          titulo="Recorrências ativas"
          valor={String(ativas.length)}
          detalhe={
            recorrencias.length === ativas.length
              ? 'nenhuma pausada'
              : `${recorrencias.length - ativas.length} pausada(s)`
          }
        />
      </FaixaDeIndicadores>

      <GerenciadorRecorrencias
        recorrencias={recorrencias}
        categorias={categorias}
        servicos={servicos.dados}
        clientes={clientes.dados}
      />

      <section className="text-muted-foreground flex flex-col gap-2 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-foreground font-medium">Como funciona</p>
        <p>
          Cada recorrência gera um lançamento comum{' '}
          <strong className="text-foreground font-semibold">
            {DIAS_DE_ANTECEDENCIA_RECORRENCIA} dias antes de vencer
          </strong>
          , já em contas a pagar (ou a receber). Não é na data do vencimento de propósito: uma conta
          que aparece no dia em que vence chega tarde para se organizar.
        </p>
        <p>
          O lançamento gerado é igual a qualquer outro — você dá baixa nele, anexa o comprovante e
          ele entra no fluxo de caixa normalmente. Mexer nele não altera a recorrência, e pausar a
          recorrência não apaga o que já foi gerado.
        </p>
        <p>
          Quem vence <strong className="text-foreground font-semibold">dia 31</strong> cai no último
          dia nos meses mais curtos, e volta ao 31 no mês seguinte — o vencimento não escorrega de
          lugar com o tempo.
        </p>
      </section>
    </div>
  );
}
