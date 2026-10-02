'use client';

import {
  PERIODICIDADES,
  ROTULO_PERIODICIDADE,
  formatarBRL,
  hojeISO,
  type CategoriaFinanceira,
  type Cliente,
  type LancamentoRecorrente,
  type Periodicidade,
  type RecorrenciaFormEntrada,
  type Servico,
  type TipoLancamento,
} from '@gestao/shared-types';
import { Pause, Play, Repeat, Trash2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Selecao } from '@/components/ui/selecao';
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
import { alternarRecorrencia, criarRecorrencia, removerRecorrencia } from './acoes';

export function GerenciadorRecorrencias({
  recorrencias,
  categorias,
  servicos,
  clientes,
}: {
  recorrencias: LancamentoRecorrente[];
  categorias: CategoriaFinanceira[];
  servicos: Servico[];
  clientes: Cliente[];
}) {
  const [erro, setErro] = useState<string>();

  return (
    <div className="flex flex-col gap-6">
      {erro && <AvisoErro mensagem={erro} />}

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2">
            <Repeat aria-hidden className="text-muted-foreground size-4" />
            Recorrências cadastradas
          </CartaoTitulo>
        </CartaoCabecalho>

        {recorrencias.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={Repeat}
              titulo="Nenhuma recorrência cadastrada"
              descricao="Cadastre o aluguel, os salários e as mensalidades uma vez — o sistema lança todo mês por você."
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Descrição</TabelaColuna>
              <TabelaColuna>Repetição</TabelaColuna>
              <TabelaColuna>Próxima</TabelaColuna>
              <TabelaColuna numerica>Valor</TabelaColuna>
              <TabelaColuna>Ações</TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {recorrencias.map((recorrencia) => (
                <LinhaRecorrencia key={recorrencia.id} recorrencia={recorrencia} onErro={setErro} />
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>

      <NovaRecorrencia
        categorias={categorias}
        servicos={servicos}
        clientes={clientes}
        onErro={setErro}
      />
    </div>
  );
}

function LinhaRecorrencia({
  recorrencia,
  onErro,
}: {
  recorrencia: LancamentoRecorrente;
  onErro: (erro?: string) => void;
}) {
  const [agindo, iniciar] = useTransition();

  const executar = (acao: () => Promise<{ erro?: string }>) => {
    iniciar(async () => {
      onErro(undefined);
      const resultado = await acao();
      onErro(resultado.erro);
    });
  };

  return (
    <TabelaLinha>
      <TabelaCelula className="min-w-56">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{recorrencia.descricao}</span>
          <span className="text-muted-foreground text-xs">
            {recorrencia.tipo === 'entrada' ? 'Entrada' : 'Saída'}
            {recorrencia.categoriaNome && ` · ${recorrencia.categoriaNome}`}
            {recorrencia.clienteNome && ` · ${recorrencia.clienteNome}`}
          </span>
        </div>
      </TabelaCelula>

      <TabelaCelula suave>
        <div className="flex flex-col gap-1">
          <span>{ROTULO_PERIODICIDADE[recorrencia.periodicidade]}</span>
          {!recorrencia.ativo && <Selo tom="atencao">Pausada</Selo>}
        </div>
      </TabelaCelula>

      <TabelaCelula suave className="tabular-nums whitespace-nowrap">
        {/* Pausada não tem "próxima": mostrar uma data que não vai acontecer é
            pior que mostrar um travessão. */}
        {recorrencia.ativo ? formatarDataCurta(recorrencia.proximaEm) : '—'}
        <div className="text-xs">
          {recorrencia.ocorrenciasGeradas === 0
            ? 'nenhuma gerada'
            : `${recorrencia.ocorrenciasGeradas} já gerada(s)`}
        </div>
      </TabelaCelula>

      <TabelaCelula
        numerica
        className={
          recorrencia.tipo === 'entrada'
            ? 'text-sucesso font-medium'
            : 'text-destructive font-medium'
        }
      >
        {recorrencia.tipo === 'saida' && '− '}
        {formatarBRL(recorrencia.valor)}
      </TabelaCelula>

      <TabelaCelula>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={agindo}
            onClick={() => executar(() => alternarRecorrencia(recorrencia.id, !recorrencia.ativo))}
            aria-label={
              recorrencia.ativo
                ? `Pausar a recorrência ${recorrencia.descricao}`
                : `Retomar a recorrência ${recorrencia.descricao}`
            }
            title={recorrencia.ativo ? 'Pausar' : 'Retomar'}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded transition-colors disabled:opacity-40"
          >
            {recorrencia.ativo ? (
              <Pause aria-hidden className="size-4" />
            ) : (
              <Play aria-hidden className="size-4" />
            )}
          </button>

          <BotaoExcluir
            recorrencia={recorrencia}
            desabilitado={agindo}
            onExcluir={() => executar(() => removerRecorrencia(recorrencia.id))}
          />
        </div>
      </TabelaCelula>
    </TabelaLinha>
  );
}

/**
 * Exclusão com confirmação em dois toques.
 *
 * O aviso diz o que **não** acontece: os lançamentos já gerados ficam. Sem
 * isso, a pessoa hesita em excluir uma recorrência antiga por medo de apagar
 * meses de histórico financeiro junto.
 */
function BotaoExcluir({
  recorrencia,
  desabilitado,
  onExcluir,
}: {
  recorrencia: LancamentoRecorrente;
  desabilitado: boolean;
  onExcluir: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        disabled={desabilitado}
        onClick={() => setConfirmando(true)}
        aria-label={`Excluir a recorrência ${recorrencia.descricao}`}
        title="Excluir"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-8 items-center justify-center rounded transition-colors disabled:opacity-40"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span className="text-muted-foreground">Excluir?</span>
      <button
        type="button"
        onClick={onExcluir}
        className="text-destructive font-semibold underline-offset-2 hover:underline"
      >
        sim
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-muted-foreground underline-offset-2 hover:underline"
      >
        não
      </button>
    </span>
  );
}

function NovaRecorrencia({
  categorias,
  servicos,
  clientes,
  onErro,
}: {
  categorias: CategoriaFinanceira[];
  servicos: Servico[];
  clientes: Cliente[];
  onErro: (erro?: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>('saida');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('mensal');
  const [inicio, setInicio] = useState(hojeISO());
  const [fim, setFim] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [criando, iniciar] = useTransition();

  // Para qual tipo cada categoria serve vem da API (`servePara`), que recusa a
  // combinação errada. A tela só filtra o que mostrar.
  const categoriasDoTipo = useMemo(
    () => categorias.filter((categoria) => categoria.servePara.includes(tipo)),
    [categorias, tipo],
  );

  const trocarTipo = (proximo: TipoLancamento) => {
    setTipo(proximo);

    // A categoria escolhida pode não servir ao tipo novo. Limpar é melhor que
    // enviar uma combinação que a API recusaria.
    const atual = categorias.find((categoria) => categoria.id === categoriaId);
    if (atual && !atual.servePara.includes(proximo)) setCategoriaId('');
  };

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();

    iniciar(async () => {
      onErro(undefined);

      const dados: RecorrenciaFormEntrada = {
        tipo,
        natureza: 'empresa',
        descricao: descricao.trim(),
        valor,
        periodicidade,
        inicio,
        fim: fim || undefined,
        categoriaId: categoriaId || undefined,
        servicoId: servicoId || undefined,
        clienteId: clienteId || undefined,
      };

      const resultado = await criarRecorrencia(dados);

      if (resultado.erro) {
        onErro(resultado.erro);
        return;
      }

      setDescricao('');
      setValor('');
      setFim('');
      setCategoriaId('');
      setServicoId('');
      setClienteId('');
    });
  };

  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>Nova recorrência</CartaoTitulo>
      </CartaoCabecalho>

      <CartaoConteudo>
        <form onSubmit={enviar} method="post" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao
              id="tipo"
              rotulo="Tipo"
              value={tipo}
              onChange={(evento) => trocarTipo(evento.target.value as TipoLancamento)}
            >
              <option value="saida">Saída — despesa que repete</option>
              <option value="entrada">Entrada — mensalidade ou contrato</option>
            </Selecao>

            <Selecao
              id="periodicidade"
              rotulo="Repetir"
              value={periodicidade}
              onChange={(evento) => setPeriodicidade(evento.target.value as Periodicidade)}
            >
              {PERIODICIDADES.map((item) => (
                <option key={item} value={item}>
                  {ROTULO_PERIODICIDADE[item]}
                </option>
              ))}
            </Selecao>
          </div>

          <Campo
            rotulo="Descrição"
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder={tipo === 'saida' ? 'Aluguel do galpão' : 'Mensalidade — contrato mensal'}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              rotulo="Valor"
              inputMode="decimal"
              value={valor}
              onChange={(evento) => setValor(evento.target.value)}
              placeholder="2.000,00"
            />

            <Campo
              rotulo="Primeiro vencimento"
              type="date"
              value={inicio}
              onChange={(evento) => setInicio(evento.target.value)}
              ajuda="Define o dia do ciclo."
            />

            <Campo
              rotulo="Repetir até"
              type="date"
              value={fim}
              onChange={(evento) => setFim(evento.target.value)}
              ajuda="Opcional. Vazio repete sem fim."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Selecao
              id="categoriaId"
              rotulo="Categoria"
              value={categoriaId}
              onChange={(evento) => setCategoriaId(evento.target.value)}
            >
              <option value="">Sem categoria</option>
              {categoriasDoTipo.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </Selecao>

            <Selecao
              id="servicoId"
              rotulo="Serviço"
              value={servicoId}
              onChange={(evento) => setServicoId(evento.target.value)}
            >
              <option value="">Não vincular</option>
              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome}
                </option>
              ))}
            </Selecao>

            <Selecao
              id="clienteId"
              rotulo="Cliente"
              value={clienteId}
              onChange={(evento) => setClienteId(evento.target.value)}
            >
              <option value="">Não vincular</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </Selecao>
          </div>

          <div>
            <Botao type="submit" carregando={criando}>
              Cadastrar recorrência
            </Botao>
          </div>
        </form>
      </CartaoConteudo>
    </Cartao>
  );
}
