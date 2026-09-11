'use client';

import { FileText, ImageIcon, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { MAX_ANEXOS_LANCAMENTO, type AnexoLancamentoInput } from '@gestao/shared-types';
import { EXTENSOES_ANEXO, ErroDeAnexo, formatarTamanho, prepararAnexo } from '@/lib/anexos';
import { cn } from '@/lib/utils';

/** Mesma chave para o mesmo arquivo: é como o campo evita anexar duas vezes. */
function chave(anexo: Pick<AnexoLancamentoInput, 'nome' | 'tamanhoBytes'>): string {
  return `${anexo.nome}:${anexo.tamanhoBytes}`;
}

/**
 * Anexos do lançamento: nota fiscal, boleto, comprovante.
 *
 * Três decisões que mudam o dia a dia de quem lança:
 *
 * 1. **Arrastar funciona.** No desktop, o comprovante costuma estar aberto ao
 *    lado; obrigar a passar pelo seletor de arquivos é um desvio inútil.
 * 2. **Erro é por arquivo.** Ao soltar cinco de uma vez, os que deram certo
 *    entram e só os problemáticos aparecem na lista de recusas, cada um com o
 *    seu motivo. Antes, um aviso único no topo do formulário era sobrescrito
 *    pelo arquivo seguinte, e a pessoa não descobria qual tinha falhado.
 * 3. **Foto grande entra.** `prepararAnexo` reduz a imagem antes de enviar, e
 *    o campo mostra o quanto encolheu — aquele "2,1 MB → 180 KB" é o que
 *    explica por que o envio ficou rápido.
 */
export function CampoAnexos({
  anexos,
  aoMudar,
  desabilitado = false,
}: {
  anexos: AnexoLancamentoInput[];
  aoMudar: (anexos: AnexoLancamentoInput[]) => void;
  desabilitado?: boolean;
}) {
  const idEntrada = useId();
  const [recusados, setRecusados] = useState<{ arquivo: string; motivo: string }[]>([]);
  const [reduzidos, setReduzidos] = useState<Record<string, number>>({});
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const vagas = MAX_ANEXOS_LANCAMENTO - anexos.length;
  const cheio = vagas <= 0;
  const bloqueado = desabilitado || cheio || processando;

  const receber = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;

    setRecusados([]);
    setProcessando(true);

    const excedentes = arquivos.slice(vagas);
    // Todos de uma vez: a leitura é assíncrona e independente por arquivo, e em
    // série cinco fotos levariam cinco vezes mais tempo sem nenhum ganho.
    const resultados = await Promise.allSettled(arquivos.slice(0, vagas).map(prepararAnexo));

    const jaAnexados = new Set(anexos.map(chave));
    const aceitos: AnexoLancamentoInput[] = [];
    const falhas = excedentes.map((arquivo) => ({
      arquivo: arquivo.name,
      motivo: `Limite de ${MAX_ANEXOS_LANCAMENTO} anexos por lançamento.`,
    }));
    const encolhidos: Record<string, number> = {};

    for (const [indice, resultado] of resultados.entries()) {
      const nome = arquivos[indice]?.name ?? 'arquivo';

      if (resultado.status === 'rejected') {
        const erro: unknown = resultado.reason;
        falhas.push({
          arquivo: erro instanceof ErroDeAnexo ? erro.arquivo : nome,
          motivo: erro instanceof Error ? erro.message : 'Não foi possível anexar.',
        });
        continue;
      }

      const { anexo, bytesOriginais } = resultado.value;

      if (jaAnexados.has(chave(anexo))) {
        falhas.push({ arquivo: anexo.nome, motivo: 'Já está anexado.' });
        continue;
      }

      jaAnexados.add(chave(anexo));
      aceitos.push(anexo);
      if (bytesOriginais) encolhidos[chave(anexo)] = bytesOriginais;
    }

    setReduzidos((atuais) => ({ ...atuais, ...encolhidos }));
    setRecusados(falhas);
    setProcessando(false);

    if (aceitos.length > 0) aoMudar([...anexos, ...aceitos]);
  };

  const aoSoltar = (evento: DragEvent<HTMLLabelElement>) => {
    evento.preventDefault();
    setArrastando(false);

    if (!bloqueado) void receber([...evento.dataTransfer.files]);
  };

  return (
    <fieldset className="border-t pt-4">
      <legend className="flex items-center gap-2 text-sm font-medium">
        <Paperclip aria-hidden className="text-muted-foreground size-4" />
        Nota fiscal, boleto ou comprovante
      </legend>

      <label
        htmlFor={idEntrada}
        onDragOver={(evento) => {
          evento.preventDefault();
          if (!bloqueado) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={cn(
          'mt-3 flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors',
          arrastando && 'border-primary bg-accent/60',
          bloqueado ? 'cursor-not-allowed opacity-60' : 'hover:bg-accent/40 cursor-pointer',
        )}
      >
        {processando ? (
          <Loader2 aria-hidden className="text-muted-foreground size-5 animate-spin" />
        ) : (
          <Upload aria-hidden className="text-muted-foreground size-5" />
        )}

        <span className="font-medium">
          {cheio
            ? `Limite de ${MAX_ANEXOS_LANCAMENTO} anexos atingido`
            : processando
              ? 'Preparando arquivos…'
              : 'Arraste aqui ou clique para escolher'}
        </span>

        <span className="text-muted-foreground text-xs">
          PDF ou imagem, até 2 MB cada · {anexos.length} de {MAX_ANEXOS_LANCAMENTO}
          {!cheio && ' · fotos grandes são reduzidas automaticamente'}
        </span>

        <input
          id={idEntrada}
          type="file"
          accept={EXTENSOES_ANEXO}
          multiple
          className="sr-only"
          disabled={bloqueado}
          onChange={(evento) => {
            const arquivos = [...(evento.target.files ?? [])];
            // Limpa antes de processar: sem isso, escolher o mesmo arquivo de
            // novo (depois de remover) não dispara `change`.
            evento.target.value = '';
            void receber(arquivos);
          }}
        />
      </label>

      {recusados.length > 0 && (
        <ul className="border-destructive/30 bg-destrutivo-suave text-destructive mt-3 space-y-1 rounded-md border px-3 py-2 text-xs">
          {recusados.map((recusa) => (
            <li key={`${recusa.arquivo}-${recusa.motivo}`}>
              <strong className="font-semibold">{recusa.arquivo}</strong>: {recusa.motivo}
            </li>
          ))}
        </ul>
      )}

      {anexos.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border">
          {anexos.map((anexo) => {
            const original = reduzidos[chave(anexo)];
            const Icone = anexo.mimeType === 'application/pdf' ? FileText : ImageIcon;

            return (
              <li key={chave(anexo)} className="flex items-center gap-3 px-3 py-2">
                <Icone aria-hidden className="text-muted-foreground size-4 shrink-0" />

                <a
                  href={anexo.conteudo}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <span className="block truncate">{anexo.nome}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {formatarTamanho(anexo.tamanhoBytes)}
                    {original && ` · reduzido de ${formatarTamanho(original)}`}
                  </span>
                </a>

                <button
                  type="button"
                  disabled={desabilitado}
                  onClick={() => {
                    setRecusados([]);
                    aoMudar(anexos.filter((item) => chave(item) !== chave(anexo)));
                  }}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-2 transition-colors disabled:opacity-50"
                  aria-label={`Remover ${anexo.nome}`}
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
