'use client';

import {
  ROTULO_ACAO_AGENDAMENTO,
  acoesAgendamentoDisponiveis,
  hojeISO,
  normalizarDinheiro,
  type RecebimentoExecucaoInput,
  type StatusAgendamento,
} from '@gestao/shared-types';
import { CircleSlash, Clock, Wallet } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  EditorMateriais,
  type LinhaMaterial,
  type MaterialDoCatalogo,
} from '@/components/painel/editor-materiais';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { SeletorSegmentado, type OpcaoSegmentada } from '@/components/ui/seletor-segmentado';
import { mudarStatusAgendamento } from './acoes';

type EscolhaRecebimento = RecebimentoExecucaoInput['situacao'] | 'nao_lancar';

const OPCOES_RECEBIMENTO: readonly OpcaoSegmentada<EscolhaRecebimento>[] = [
  { valor: 'recebido', rotulo: 'Já recebi', icone: Wallet, tom: 'positivo' },
  { valor: 'a_receber', rotulo: 'Vou receber', icone: Clock },
  { valor: 'nao_lancar', rotulo: 'Não lançar', icone: CircleSlash },
];

const AJUDA_RECEBIMENTO: Record<EscolhaRecebimento, string> = {
  recebido: 'Entra no caixa agora, ligada a este serviço e cliente.',
  a_receber: 'Fica como conta a receber. Quando o dinheiro cair, é só dar baixa.',
  nao_lancar: 'Nada vai para o financeiro. Use se você já lançou ou vai lançar à mão.',
};

/**
 * Botões de transição de um agendamento.
 *
 * Quais aparecem sai de `acoesAgendamentoDisponiveis`, a mesma tabela que a API
 * usa para validar. A tela nunca oferece uma ação que o servidor recusaria.
 *
 * Executar abre antes uma conferência, que junta numa tela só o que antes
 * exigia ir a três: os materiais usados (com `catalogo`) e o dinheiro do
 * serviço (com `podeLancarReceita`). Sem nenhum dos dois, executa direto — e a
 * API baixa a lista padrão de materiais do serviço.
 */
export function AcoesAgendamento({
  id,
  status,
  catalogo,
  materiaisPadrao = [],
  valorSugerido = null,
  podeLancarReceita = false,
}: {
  id: string;
  status: StatusAgendamento;
  catalogo?: MaterialDoCatalogo[];
  materiaisPadrao?: LinhaMaterial[];
  /** Pré-preenche o valor recebido. Vem do orçamento ou do preço do serviço. */
  valorSugerido?: string | null;
  /** Quem não tem `financeiro.criar` executa sem a pergunta do dinheiro. */
  podeLancarReceita?: boolean;
}) {
  const [erro, setErro] = useState<string>();
  const [executando, iniciar] = useTransition();
  const [conferindo, setConferindo] = useState(false);
  const [linhas, setLinhas] = useState(materiaisPadrao);

  // "Já recebi" é o padrão: na maioria dos serviços o cliente paga na hora, e
  // com o valor sugerido a execução inteira vira um clique em "Confirmar".
  const [escolha, setEscolha] = useState<EscolhaRecebimento>('recebido');
  const [valor, setValor] = useState(valorSugerido?.replace('.', ',') ?? '');
  const [vencimento, setVencimento] = useState(hojeISO);

  const acoes = acoesAgendamentoDisponiveis(status);
  const precisaConferir = Boolean(catalogo) || podeLancarReceita;

  if (acoes.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  function montarRecebimento(): RecebimentoExecucaoInput | undefined {
    if (!podeLancarReceita || escolha === 'nao_lancar') return undefined;

    const valorNormalizado = normalizarDinheiro(valor);

    return escolha === 'recebido'
      ? { situacao: 'recebido', valor: valorNormalizado }
      : { situacao: 'a_receber', valor: valorNormalizado, vencimento };
  }

  if (conferindo && precisaConferir) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-md border p-3">
        {catalogo && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Materiais usados neste serviço</p>
              <p className="text-muted-foreground text-xs">
                Confira as quantidades. O estoque baixa pelo custo médio e o custo entra na margem
                do serviço.
              </p>
            </div>

            <EditorMateriais
              catalogo={catalogo}
              linhas={linhas}
              aoMudar={setLinhas}
              desabilitado={executando}
            />
          </section>
        )}

        {podeLancarReceita && (
          <section className="flex flex-col gap-3">
            <SeletorSegmentado
              name={`recebimento-${id}`}
              rotulo="E o pagamento?"
              ajuda={AJUDA_RECEBIMENTO[escolha]}
              opcoes={OPCOES_RECEBIMENTO}
              valor={escolha}
              aoMudar={setEscolha}
              desabilitado={executando}
            />

            {escolha !== 'nao_lancar' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  id={`valor-${id}`}
                  rotulo={escolha === 'recebido' ? 'Valor recebido (R$)' : 'Valor a receber (R$)'}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valor}
                  onChange={(evento) => setValor(evento.target.value)}
                  disabled={executando}
                  ajuda={valorSugerido ? 'Sugerido pelo orçamento ou preço do serviço.' : undefined}
                />

                {escolha === 'a_receber' && (
                  <Campo
                    id={`vencimento-${id}`}
                    rotulo="Vence em"
                    type="date"
                    value={vencimento}
                    onChange={(evento) => setVencimento(evento.target.value)}
                    disabled={executando}
                  />
                )}
              </div>
            )}
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            carregando={executando}
            onClick={() =>
              iniciar(async () => {
                setErro(undefined);
                const resultado = await mudarStatusAgendamento(
                  id,
                  'executar',
                  catalogo ? linhas : undefined,
                  montarRecebimento(),
                );
                setErro(resultado.erro);
                if (!resultado.erro) setConferindo(false);
              })
            }
          >
            Confirmar execução
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => setConferindo(false)}>
            Voltar
          </Botao>
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            disabled={executando}
            onClick={() => {
              if (acao === 'executar' && precisaConferir) {
                setErro(undefined);
                setConferindo(true);
                return;
              }

              iniciar(async () => {
                setErro(undefined);
                const resultado = await mudarStatusAgendamento(id, acao);
                setErro(resultado.erro);
              });
            }}
            className={`focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
              // "Executado" é a ação que fecha o ciclo e cria o registro no
              // histórico — merece destaque entre as demais. O verde sai do
              // token de sucesso, o mesmo dos selos, e não de uma cor crua.
              acao === 'executar'
                ? 'border-sucesso/40 bg-sucesso-suave text-sucesso hover:bg-sucesso/20'
                : 'hover:bg-accent'
            }`}
          >
            {ROTULO_ACAO_AGENDAMENTO[acao]}
          </button>
        ))}
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}
    </div>
  );
}
