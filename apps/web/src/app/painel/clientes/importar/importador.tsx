'use client';

import {
  LIMITE_IMPORTACAO,
  ROTULO_MOTIVO_IGNORADO,
  type ClienteIgnorado,
} from '@gestao/shared-types';
import { ArrowLeft, CircleCheck, FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type DragEvent } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { detectarColunas, type CampoImportavel } from '@/lib/colunas-cliente';
import { ErroDePlanilha, EXTENSOES_ACEITAS, lerPlanilha, type PlanilhaLida } from '@/lib/planilha';
import { importarClientes, revalidarClientes } from '../acoes';
import { avaliarLinhas } from './avaliar';
import { Conferencia } from './conferencia';
import { ModeloPlanilha } from './modelo-planilha';

type Etapa = 'arquivo' | 'conferencia' | 'resultado';

interface Resultado {
  criados: number;
  ignorados: ClienteIgnorado[];
  /** Linhas que a tela nem enviou, por não passarem na validação. */
  invalidas: number;
}

/**
 * Importação de clientes por planilha.
 *
 * Três passos, na ordem em que a dúvida aparece: qual arquivo, o que ele
 * contém, e o que aconteceu. O passo do meio existe para que ninguém grave
 * trezentos clientes errados — é mais barato conferir antes do que corrigir
 * depois, um a um.
 */
export function Importador() {
  const [etapa, setEtapa] = useState<Etapa>('arquivo');
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [mapa, setMapa] = useState<Record<CampoImportavel, number | null> | null>(null);
  const [erro, setErro] = useState<string>();
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [enviadas, setEnviadas] = useState(0);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Revalidar só quando a planilha ou o mapeamento mudam: a validação percorre
  // o arquivo inteiro, e refazê-la a cada tecla travaria a tela em arquivos
  // grandes.
  const avaliadas = useMemo(
    () => (planilha && mapa ? avaliarLinhas(planilha.linhas, mapa) : []),
    [planilha, mapa],
  );

  const prontas = useMemo(() => avaliadas.filter((linha) => linha.valida), [avaliadas]);

  async function carregar(arquivo: File): Promise<void> {
    setErro(undefined);
    setLendo(true);

    try {
      const lida = await lerPlanilha(arquivo);

      setPlanilha(lida);
      setMapa(detectarColunas(lida.cabecalhos));
      setNomeArquivo(arquivo.name);
      setEtapa('conferencia');
    } catch (falha) {
      setErro(
        falha instanceof ErroDePlanilha
          ? falha.message
          : 'Não foi possível ler o arquivo. Confira se ele é uma planilha válida.',
      );
    } finally {
      setLendo(false);
    }
  }

  function aoSoltar(evento: DragEvent<HTMLLabelElement>): void {
    evento.preventDefault();
    setArrastando(false);

    const arquivo = evento.dataTransfer.files[0];
    if (arquivo) void carregar(arquivo);
  }

  /**
   * Envia em lotes, em série.
   *
   * O teto por requisição vem do contrato compartilhado. Em série, e não em
   * paralelo, porque o guard de limite de plano trava a linha da empresa: lotes
   * simultâneos esperariam um pelo outro de qualquer jeito, só que sem
   * progresso honesto na tela.
   */
  async function importar(): Promise<void> {
    setImportando(true);
    setErro(undefined);
    setEnviadas(0);

    const lotes: (typeof prontas)[] = [];
    for (let inicio = 0; inicio < prontas.length; inicio += LIMITE_IMPORTACAO) {
      lotes.push(prontas.slice(inicio, inicio + LIMITE_IMPORTACAO));
    }

    let criados = 0;
    const ignorados: ClienteIgnorado[] = [];
    let jaEnviadas = 0;

    for (const lote of lotes) {
      const resposta = await importarClientes(lote.map((linha) => linha.dados!));

      if (resposta.erro || !resposta.resultado) {
        setErro(resposta.erro ?? 'A importação falhou no meio do caminho.');
        setImportando(false);

        // Interrompe, mas mantém o que já entrou: esconder isso faria o usuário
        // reimportar e duplicar o que deu certo.
        if (criados > 0) {
          setResultado({ criados, ignorados, invalidas: avaliadas.length - prontas.length });
          setEtapa('resultado');
        }

        return;
      }

      criados += resposta.resultado.criados;

      // O índice volta relativo ao lote; somamos o deslocamento para a tela
      // poder apontar a linha certa da planilha.
      for (const ignorado of resposta.resultado.ignorados) {
        ignorados.push({ ...ignorado, indice: ignorado.indice + jaEnviadas });
      }

      jaEnviadas += lote.length;
      setEnviadas(jaEnviadas);
    }

    await revalidarClientes();

    setResultado({ criados, ignorados, invalidas: avaliadas.length - prontas.length });
    setEtapa('resultado');
    setImportando(false);
  }

  function recomecar(): void {
    setPlanilha(null);
    setMapa(null);
    setNomeArquivo('');
    setResultado(null);
    setErro(undefined);
    setEnviadas(0);
    setEtapa('arquivo');
  }

  return (
    <div className="flex flex-col gap-6">
      <Passos atual={etapa} />

      {erro && <AvisoErro mensagem={erro} />}

      {etapa === 'arquivo' && (
        <div className="flex flex-col gap-4">
          <label
            onDragOver={(evento) => {
              evento.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors ${
              arrastando ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
            }`}
          >
            <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <Upload aria-hidden className="size-5" />
            </span>

            <span className="flex flex-col gap-1">
              <span className="font-semibold">
                {lendo ? 'Lendo a planilha…' : 'Arraste a planilha aqui'}
              </span>
              <span className="text-muted-foreground text-sm">
                ou clique para escolher um arquivo {EXTENSOES_ACEITAS.join(', ')}
              </span>
            </span>

            <input
              type="file"
              accept={EXTENSOES_ACEITAS.join(',')}
              disabled={lendo}
              className="sr-only"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0];
                if (arquivo) void carregar(arquivo);
                // Limpa para permitir escolher o mesmo arquivo de novo depois
                // de corrigi-lo — sem isto o `change` não dispararia.
                evento.target.value = '';
              }}
            />
          </label>

          <Cartao className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet aria-hidden className="text-muted-foreground mt-0.5 size-5" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Como a planilha precisa estar</p>
                <p className="text-muted-foreground text-sm">
                  A primeira linha deve conter os títulos das colunas. Só o nome é obrigatório;
                  telefone, e-mail, CPF/CNPJ, origem e observações entram se existirem.
                </p>
              </div>
            </div>

            <ModeloPlanilha />
          </Cartao>
        </div>
      )}

      {etapa === 'conferencia' && planilha && mapa && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Arquivo: <span className="text-foreground font-medium">{nomeArquivo}</span> ·{' '}
              {planilha.linhas.length} {planilha.linhas.length === 1 ? 'linha' : 'linhas'}
              {/* Só avisa quando há escolha a fazer: com uma aba só, dizer o
                  nome dela seria ruído. */}
              {planilha.totalAbas && planilha.totalAbas > 1 && (
                <>
                  {' '}
                  · lendo a aba <span className="text-foreground font-medium">{planilha.aba}</span>,
                  a primeira de {planilha.totalAbas}
                </>
              )}
            </p>

            <Botao variante="sutil" tamanho="sm" onClick={recomecar} disabled={importando}>
              <ArrowLeft aria-hidden />
              Trocar arquivo
            </Botao>
          </div>

          <Conferencia
            cabecalhos={planilha.cabecalhos}
            mapa={mapa}
            aoTrocarColuna={(campo, indice) =>
              setMapa((atual) => (atual ? { ...atual, [campo]: indice } : atual))
            }
            avaliadas={avaliadas}
          />

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Botao
              onClick={() => void importar()}
              carregando={importando}
              disabled={prontas.length === 0}
            >
              Importar {prontas.length} {prontas.length === 1 ? 'cliente' : 'clientes'}
            </Botao>

            {importando && prontas.length > LIMITE_IMPORTACAO && (
              <p className="text-muted-foreground text-sm">
                {enviadas} de {prontas.length} enviados…
              </p>
            )}

            {prontas.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nenhuma linha está pronta. Confira o mapeamento das colunas acima.
              </p>
            )}
          </div>
        </>
      )}

      {etapa === 'resultado' && resultado && (
        <ResultadoImportacaoView resultado={resultado} aoRecomecar={recomecar} />
      )}
    </div>
  );
}

/** Trilha dos três passos. Orienta sem prometer o que ainda não aconteceu. */
function Passos({ atual }: { atual: Etapa }) {
  const passos: { chave: Etapa; rotulo: string }[] = [
    { chave: 'arquivo', rotulo: 'Escolher arquivo' },
    { chave: 'conferencia', rotulo: 'Conferir' },
    { chave: 'resultado', rotulo: 'Pronto' },
  ];

  const posicaoAtual = passos.findIndex((passo) => passo.chave === atual);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {passos.map((passo, indice) => {
        const concluido = indice < posicaoAtual;
        const ativo = indice === posicaoAtual;

        return (
          <li key={passo.chave} className="flex items-center gap-2">
            <span
              aria-current={ativo ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                ativo
                  ? 'bg-primary/10 text-primary font-medium'
                  : concluido
                    ? 'text-sucesso'
                    : 'text-muted-foreground'
              }`}
            >
              <span className="numerico text-xs">
                {concluido ? <CircleCheck aria-hidden className="size-3.5" /> : indice + 1}
              </span>
              {passo.rotulo}
            </span>

            {indice < passos.length - 1 && (
              <span aria-hidden className="text-muted-foreground/40">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultadoImportacaoView({
  resultado,
  aoRecomecar,
}: {
  resultado: Resultado;
  aoRecomecar: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Cartao className="flex flex-col items-start gap-3 p-6">
        <span className="bg-sucesso-suave text-sucesso flex size-10 items-center justify-center rounded-full">
          <CircleCheck aria-hidden className="size-5" />
        </span>

        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {resultado.criados === 0
              ? 'Nenhum cliente novo foi criado'
              : `${resultado.criados} ${resultado.criados === 1 ? 'cliente importado' : 'clientes importados'}`}
          </h2>

          <p className="text-muted-foreground text-sm">
            {resultado.criados > 0 && 'Todos já entraram na primeira etapa do funil. '}
            {resultado.ignorados.length > 0 &&
              (resultado.ignorados.length === 1
                ? '1 linha foi pulada por já existir. '
                : `${resultado.ignorados.length} linhas foram puladas por já existirem. `)}
            {resultado.invalidas > 0 &&
              (resultado.invalidas === 1
                ? '1 linha ficou de fora por erro de preenchimento.'
                : `${resultado.invalidas} linhas ficaram de fora por erro de preenchimento.`)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/painel/clientes" className={estilosBotao()}>
            Ver clientes
          </Link>
          <Botao variante="secundario" onClick={aoRecomecar}>
            Importar outra planilha
          </Botao>
        </div>
      </Cartao>

      {resultado.ignorados.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold tracking-tight">Linhas puladas</h3>
            <p className="text-muted-foreground text-sm">
              Nada foi sobrescrito: quando o cliente já existe, a importação preserva o cadastro
              atual em vez de substituí-lo.
            </p>
          </div>

          <Cartao className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resultado.ignorados.map((ignorado) => (
                  <tr key={`${ignorado.indice}-${ignorado.nome}`}>
                    <td className="px-4 py-3 font-medium">{ignorado.nome}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {ROTULO_MOTIVO_IGNORADO[ignorado.motivo]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </section>
      )}
    </div>
  );
}
