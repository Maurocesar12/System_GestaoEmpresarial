'use client';

import {
  MAX_PARCELAS,
  ROTULO_NATUREZA,
  ROTULO_TIPO_LANCAMENTO,
  formatarBRL,
  hojeISO,
  type AnexoLancamentoInput,
  type CategoriaFinanceira,
  type Cliente,
  type Lancamento,
  type LancamentoFormEntrada,
  type NaturezaLancamento,
  type Servico,
  type TipoLancamento,
} from '@gestao/shared-types';
import { ArrowDownCircle, ArrowUpCircle, Building2, Clock, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Selecao } from '@/components/ui/selecao';
import { SeletorSegmentado, type OpcaoSegmentada } from '@/components/ui/seletor-segmentado';
import type { ResultadoAcao } from '@/lib/acoes';
import { useSimulacao } from '@/lib/simulacao';
import { salvarLancamento, simularParcelas } from './acoes';
import { CampoAnexos } from './campo-anexos';

const CAMPOS = [
  'tipo',
  'natureza',
  'descricao',
  'valor',
  'data',
  'vencimento',
  'pagoEm',
  'categoriaId',
  'servicoId',
  'clienteId',
  'anexos',
  'parcelas',
] as const;

const OPCOES_TIPO = [
  {
    valor: 'entrada',
    rotulo: ROTULO_TIPO_LANCAMENTO.entrada,
    icone: ArrowUpCircle,
    tom: 'positivo',
  },
  { valor: 'saida', rotulo: ROTULO_TIPO_LANCAMENTO.saida, icone: ArrowDownCircle, tom: 'negativo' },
] as const satisfies readonly OpcaoSegmentada<TipoLancamento>[];

const OPCOES_NATUREZA = [
  { valor: 'empresa', rotulo: ROTULO_NATUREZA.empresa, icone: Building2 },
  { valor: 'pessoal', rotulo: ROTULO_NATUREZA.pessoal, icone: User },
] as const satisfies readonly OpcaoSegmentada<NaturezaLancamento>[];

/** As duas situações possíveis de um lançamento, do ponto de vista do caixa. */
type Situacao = 'liquidado' | 'aberto';

/**
 * Formulário de lançamento.
 *
 * ## O que a pessoa precisa decidir, e em que ordem
 *
 * Entrou ou saiu → quanto e quando → já foi pago ou não. Essas três perguntas
 * ficam no topo, cada uma resolvida em um clique ou uma digitação. Tudo que é
 * opcional (serviço, categoria, cliente, anexo) vem depois, recolhido, porque
 * exigir decisão sobre campo opcional é o que faz um lançamento de dez
 * segundos virar um de dois minutos.
 *
 * ## Por que "situação" em vez de campo de data vazio
 *
 * Antes, "pago em" vazio era o que definia uma conta a receber — uma regra
 * invisível, que só aparecia depois, quando o saldo não batia. Agora a pergunta
 * é explícita ("Já foi pago?" / "Em aberto"), e o campo de data só existe no
 * caso em que faz sentido. O `vencimento` segue a mesma lógica: só interessa em
 * conta em aberto, e some quando o valor já foi liquidado.
 *
 * O campo de serviço continua com destaque e explicação: é ele que torna a
 * margem calculável, e quem preenche precisa saber disso na hora — não ao
 * estranhar o relatório no fim do mês.
 */
export function FormularioLancamento({
  lancamento,
  categorias,
  servicos,
  clientes,
}: {
  lancamento?: Lancamento;
  categorias: CategoriaFinanceira[];
  servicos: Servico[];
  clientes: Cliente[];
}) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();

  const anexosIniciais: AnexoLancamentoInput[] = (lancamento?.anexos ?? [])
    .filter((anexo) => anexo.conteudo)
    .map((anexo) => ({
      id: anexo.id,
      nome: anexo.nome,
      mimeType: anexo.mimeType,
      tamanhoBytes: anexo.tamanhoBytes,
      conteudo: anexo.conteudo ?? '',
    }));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LancamentoFormEntrada>({
    defaultValues: {
      tipo: lancamento?.tipo ?? 'entrada',
      natureza: lancamento?.natureza ?? 'empresa',
      descricao: lancamento?.descricao ?? '',
      valor: lancamento?.valor.replace('.', ',') ?? '',
      data: lancamento?.data ?? hojeISO(),
      vencimento: lancamento?.vencimento ?? '',
      // Lançamento novo nasce **pago**, com a data de hoje: o caso mais comum é
      // registrar algo que acabou de acontecer.
      pagoEm: lancamento ? (lancamento.pagoEm ?? '') : hojeISO(),
      categoriaId: lancamento?.categoriaId ?? '',
      servicoId: lancamento?.servicoId ?? '',
      clienteId: lancamento?.clienteId ?? '',
      anexos: anexosIniciais,
      // Um significa avulso. O campo só aparece na criação, e o padrão tem de
      // ser o caso comum: a maioria dos lançamentos não é parcelada.
      parcelas: 1,
    },
  });

  // Os três controles que não são `<input>` puro passam pelo `useController`:
  // ele mantém o formulário como fonte única do valor, em vez de um `useState`
  // paralelo que precisa ser lembrado na hora de enviar.
  const tipoCampo = useController({ control, name: 'tipo' });
  const naturezaCampo = useController({ control, name: 'natureza' });
  const anexosCampo = useController({ control, name: 'anexos' });

  const pagoEm = useWatch({ control, name: 'pagoEm' });
  const situacao: Situacao = pagoEm ? 'liquidado' : 'aberto';
  const tipo = tipoCampo.field.value;
  const entrada = tipo === 'entrada';

  const categoriaEscolhida = useWatch({ control, name: 'categoriaId' });

  const valorDigitado = useWatch({ control, name: 'valor' });
  const parcelasDigitadas = useWatch({ control, name: 'parcelas' });

  /**
   * A prévia da divisão, calculada pela API com a mesma função da gravação:
   * o valor prometido na tela é, por construção, o valor salvo. Entrada que a
   * API recusa (parcela 1, valor vazio) simplesmente não mostra prévia.
   */
  const simulacao = useSimulacao(
    valorDigitado && parcelasDigitadas
      ? { valor: String(valorDigitado), parcelas: String(parcelasDigitadas) }
      : null,
    simularParcelas,
  );

  const previaParcelas = simulacao && {
    quantidade: simulacao.quantidade,
    valor: formatarBRL(simulacao.valorParcela),
    // Só mostra a última quando ela difere — a API já devolve `null` quando é
    // igual, e "a última de R$ 100" seria ruído.
    ultima: simulacao.ultimaParcela ? formatarBRL(simulacao.ultimaParcela) : null,
  };

  /**
   * Só as categorias que servem ao tipo escolhido.
   *
   * Uma entrada não deveria oferecer "Aluguel — custo fixo", e era exatamente
   * isso que acontecia: a lista vinha inteira, e classificar receita como custo
   * distorce o custo por dia e a margem sem nenhum sinal de erro.
   *
   * A categoria já selecionada entra na lista mesmo quando não serve ao tipo.
   * Lançamentos criados antes desta separação têm entrada apontando para
   * categoria de custo, e escondê-la das opções faria o próximo salvamento
   * apagar o vínculo — perda de dado silenciosa ao abrir a tela para mexer em
   * outra coisa.
   */
  const categoriasDoTipo = useMemo(
    () =>
      // `servePara` vem da API, que é quem recusa a combinação errada.
      categorias.filter(
        (categoria) => categoria.servePara.includes(tipo) || categoria.id === categoriaEscolhida,
      ),
    [categorias, tipo, categoriaEscolhida],
  );

  /**
   * Troca o tipo e descarta a categoria que deixou de fazer sentido.
   *
   * Sem isto, mudar de entrada para saída manteria uma categoria de receita
   * selecionada — e salvaria uma despesa classificada como receita. Só limpa
   * quando a categoria realmente não serve ao tipo novo; se serve, fica.
   */
  const trocarTipo = (proximo: TipoLancamento) => {
    tipoCampo.field.onChange(proximo);

    const atual = categorias.find((categoria) => categoria.id === categoriaEscolhida);

    if (atual && !atual.servePara.includes(proximo)) {
      setValue('categoriaId', '', { shouldValidate: true });
    }
  };

  const trocarSituacao = (proxima: Situacao) => {
    // Preenche e limpa a data no lugar da pessoa: a situação é a pergunta, a
    // data é consequência. Quem precisar de outro dia edita o campo, que
    // aparece logo abaixo.
    setValue('pagoEm', proxima === 'liquidado' ? hojeISO() : '', { shouldValidate: true });
  };

  const aoEnviar = (dados: LancamentoFormEntrada) => {
    setFalha(undefined);

    iniciarEnvio(async () => {
      const resultado = await salvarLancamento(lancamento?.id ?? null, dados);

      if (resultado?.campos) {
        for (const [campo, mensagens] of Object.entries(resultado.campos)) {
          if ((CAMPOS as readonly string[]).includes(campo)) {
            setError(campo as (typeof CAMPOS)[number], { message: mensagens[0] });
          }
        }
      }

      setFalha(resultado);
    });
  };

  const temVinculo = Boolean(
    lancamento?.servicoId ?? lancamento?.categoriaId ?? lancamento?.clienteId,
  );

  return (
    <form
      method="post"
      onSubmit={handleSubmit(aoEnviar)}
      className="flex max-w-xl flex-col gap-4"
      noValidate
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} detalhes={falha.campos} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <SeletorSegmentado
          rotulo="Tipo"
          name="tipo"
          opcoes={OPCOES_TIPO}
          valor={tipo}
          aoMudar={trocarTipo}
        />

        <SeletorSegmentado
          rotulo="Natureza"
          name="natureza"
          opcoes={OPCOES_NATUREZA}
          valor={naturezaCampo.field.value}
          aoMudar={naturezaCampo.field.onChange}
          // A separação é o que impede o gasto pessoal de distorcer a margem.
          ajuda="Pessoal fica fora do caixa da empresa e dos relatórios."
        />
      </div>

      <Campo
        rotulo="Descrição"
        placeholder={entrada ? 'Serviço prestado a…' : 'Compra de material'}
        erro={errors.descricao?.message}
        {...register('descricao')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Valor"
          inputMode="decimal"
          placeholder="1.500,00"
          erro={errors.valor?.message}
          {...register('valor')}
        />

        <Campo
          rotulo="Data"
          type="date"
          ajuda={entrada ? 'Quando o serviço foi prestado.' : 'Quando a despesa aconteceu.'}
          erro={errors.data?.message}
          {...register('data')}
        />
      </div>

      {/*
        A distinção mais importante do formulário — e a que mais confunde quem
        está aprendendo: isto é dinheiro em caixa ou uma conta em aberto?
      */}
      <fieldset className="flex flex-col gap-3 border-t pt-4">
        <legend className="sr-only">Situação do pagamento</legend>

        <SeletorSegmentado
          rotulo="Situação"
          name="situacao"
          valor={situacao}
          aoMudar={trocarSituacao}
          opcoes={[
            {
              valor: 'liquidado',
              rotulo: entrada ? 'Já recebi' : 'Já paguei',
              icone: Wallet,
              tom: 'positivo',
            },
            {
              valor: 'aberto',
              rotulo: entrada ? 'A receber' : 'A pagar',
              icone: Clock,
            },
          ]}
        />

        {situacao === 'liquidado' ? (
          <Campo
            rotulo={entrada ? 'Recebido em' : 'Pago em'}
            type="date"
            ajuda="Entra no fluxo de caixa nesta data."
            erro={errors.pagoEm?.message}
            {...register('pagoEm')}
          />
        ) : (
          <>
            <Campo
              rotulo="Vencimento"
              type="date"
              ajuda="Opcional. É o que permite cobrar (ou pagar) no prazo certo."
              erro={errors.vencimento?.message}
              {...register('vencimento')}
            />

            <p className="bg-atencao-suave text-atencao rounded-md px-3 py-2 text-xs">
              Fica como{' '}
              <strong className="font-semibold">{entrada ? 'a receber' : 'a pagar'}</strong> e não
              entra no fluxo de caixa nem na margem até você dar baixa.
            </p>
          </>
        )}
      </fieldset>

      {/*
        Parcelamento só na criação.

        Dividir um lançamento que já existe significaria apagá-lo e criar N no
        lugar — e ele pode já ter baixa, anexo e vínculo com comissão. Quem
        precisa disso exclui e lança de novo, conscientemente.
      */}
      {!lancamento && (
        <fieldset className="flex flex-col gap-3 border-t pt-4">
          <legend className="sr-only">Parcelamento</legend>

          <Campo
            rotulo="Dividir em"
            type="number"
            min={1}
            max={MAX_PARCELAS}
            ajuda={`O valor acima é o total. Até ${MAX_PARCELAS}x.`}
            erro={errors.parcelas?.message}
            {...register('parcelas')}
          />

          {previaParcelas && (
            <div className="bg-accent/50 rounded-md px-3 py-2 text-xs">
              {/*
                A prévia é o que faz a pessoa confiar no número. Sem ela, "3x"
                de R$ 1.000 deixa a dúvida de para onde foi o centavo — e a
                resposta (a última parcela absorve a sobra) é melhor mostrada
                que explicada.
              */}
              <p>
                {previaParcelas.quantidade}x de{' '}
                <strong className="font-semibold">{previaParcelas.valor}</strong>
                {previaParcelas.ultima && (
                  <>
                    , a última de <strong className="font-semibold">{previaParcelas.ultima}</strong>
                  </>
                )}
              </p>
              <p className="text-muted-foreground mt-1">
                Uma conta {entrada ? 'a receber' : 'a pagar'} por parcela, vencendo de mês em mês.
              </p>
            </div>
          )}
        </fieldset>
      )}

      {/*
        Recolhido por padrão: são três campos opcionais que, abertos, dobram o
        tamanho do formulário. Já vêm abertos ao editar um lançamento que usa
        algum deles, para o vínculo não ficar escondido de quem o criou.
      */}
      <details open={temVinculo} className="rounded-lg border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Vincular a serviço, categoria ou cliente
          <span className="text-muted-foreground font-normal"> · opcional</span>
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <Selecao
            rotulo="Serviço"
            ajuda={
              entrada
                ? 'Vincular é o que permite saber quanto este serviço faturou e qual a margem dele.'
                : 'Vincule custos ao serviço que os gerou para a margem sair correta.'
            }
            erro={errors.servicoId?.message}
            {...register('servicoId')}
          >
            <option value="">Não vincular</option>
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>
                {servico.nome}
              </option>
            ))}
          </Selecao>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao
              rotulo="Categoria"
              erro={errors.categoriaId?.message}
              {...register('categoriaId')}
            >
              <option value="">Sem categoria</option>
              {categoriasDoTipo.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </Selecao>

            <Selecao rotulo="Cliente" erro={errors.clienteId?.message} {...register('clienteId')}>
              <option value="">Não vincular</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </Selecao>
          </div>
        </div>
      </details>

      <CampoAnexos
        anexos={anexosCampo.field.value ?? []}
        aoMudar={anexosCampo.field.onChange}
        desabilitado={enviando}
      />

      {errors.anexos?.message && (
        <p className="text-destructive text-xs">{errors.anexos.message}</p>
      )}

      <div className="flex gap-3">
        <Botao type="submit" carregando={enviando}>
          {lancamento ? 'Salvar alterações' : 'Lançar'}
        </Botao>

        <Link href="/painel/financeiro" className={estilosBotao({ variante: 'secundario' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
