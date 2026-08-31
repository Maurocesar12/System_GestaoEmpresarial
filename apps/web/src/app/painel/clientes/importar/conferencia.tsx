'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { Cartao } from '@/components/ui/cartao';
import { Selecao } from '@/components/ui/selecao';
import { Selo } from '@/components/ui/selo';
import {
  CAMPOS_IMPORTAVEIS,
  CAMPO_OBRIGATORIO,
  ROTULO_CAMPO,
  type CampoImportavel,
} from '@/lib/colunas-cliente';
import type { LinhaAvaliada } from './avaliar';

/** Quantas linhas a prévia mostra. Validar todas, exibir algumas. */
const LINHAS_NA_PREVIA = 30;

/**
 * Passo de conferência: para onde vai cada coluna, e o que será importado.
 *
 * A prévia mostra as primeiras trinta linhas, mas a contagem considera o
 * arquivo inteiro. Desenhar cinco mil linhas travaria o navegador sem informar
 * mais nada — quem vai conferir linha a linha faz isso na planilha, não aqui.
 */
export function Conferencia({
  cabecalhos,
  mapa,
  aoTrocarColuna,
  avaliadas,
}: {
  cabecalhos: string[];
  mapa: Record<CampoImportavel, number | null>;
  aoTrocarColuna: (campo: CampoImportavel, indice: number | null) => void;
  avaliadas: LinhaAvaliada[];
}) {
  const validas = avaliadas.filter((linha) => linha.valida);
  const invalidas = avaliadas.filter((linha) => !linha.valida);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold tracking-tight">De onde vem cada informação</h2>
          <p className="text-muted-foreground text-sm">
            Reconhecemos as colunas pelo título. Ajuste o que estiver trocado — a planilha original
            não muda.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS_IMPORTAVEIS.map((campo) => (
            <Selecao
              key={campo}
              rotulo={ROTULO_CAMPO[campo]}
              value={mapa[campo] ?? ''}
              onChange={(evento) =>
                aoTrocarColuna(
                  campo,
                  evento.target.value === '' ? null : Number(evento.target.value),
                )
              }
              ajuda={
                campo === CAMPO_OBRIGATORIO && mapa[campo] === null
                  ? 'Obrigatório: sem nome não dá para criar o cliente.'
                  : undefined
              }
              erro={
                campo === CAMPO_OBRIGATORIO && mapa[campo] === null
                  ? 'Escolha a coluna do nome'
                  : undefined
              }
            >
              <option value="">Não importar</option>
              {cabecalhos.map((cabecalho, indice) => (
                <option key={`${cabecalho}-${indice}`} value={indice}>
                  {cabecalho || `Coluna ${indice + 1}`}
                </option>
              ))}
            </Selecao>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold tracking-tight">O que será importado</h2>

          <div className="flex flex-wrap gap-2">
            <Selo tom="sucesso" comPonto>
              {validas.length} {validas.length === 1 ? 'linha pronta' : 'linhas prontas'}
            </Selo>

            {invalidas.length > 0 && (
              <Selo tom="perigo" comPonto>
                {invalidas.length} com problema
              </Selo>
            )}
          </div>
        </div>

        {invalidas.length > 0 && (
          <p className="bg-atencao-suave text-atencao rounded-md px-3 py-2 text-sm">
            As linhas com problema são <strong className="font-semibold">puladas</strong>: as demais
            entram normalmente. Corrija na planilha e suba de novo se quiser incluí-las.
          </p>
        )}

        <Cartao className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Linha</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Situação</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {avaliadas.slice(0, LINHAS_NA_PREVIA).map((linha) => (
                <tr
                  key={linha.numeroNaPlanilha}
                  className={linha.valida ? undefined : 'bg-destrutivo-suave/40'}
                >
                  <td className="numerico text-muted-foreground px-4 py-3">
                    {linha.numeroNaPlanilha}
                  </td>

                  <td className="px-4 py-3 font-medium">{linha.bruto.nome || '—'}</td>

                  <td className="text-muted-foreground px-4 py-3">
                    <div className="flex flex-col">
                      {linha.bruto.telefone && <span>{linha.bruto.telefone}</span>}
                      {linha.bruto.email && <span className="text-xs">{linha.bruto.email}</span>}
                      {!linha.bruto.telefone && !linha.bruto.email && <span>—</span>}
                    </div>
                  </td>

                  <td className="numerico text-muted-foreground px-4 py-3">
                    {linha.bruto.documento || '—'}
                  </td>

                  <td className="px-4 py-3">
                    {linha.valida ? (
                      <span className="text-sucesso flex items-center gap-1.5 text-xs">
                        <CircleCheck aria-hidden className="size-3.5" />
                        Pronta
                      </span>
                    ) : (
                      <span className="text-destructive flex items-start gap-1.5 text-xs">
                        <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        {linha.erros.join(' · ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>

        {avaliadas.length > LINHAS_NA_PREVIA && (
          <p className="text-muted-foreground text-xs">
            Mostrando as primeiras {LINHAS_NA_PREVIA} linhas de {avaliadas.length}. A contagem acima
            considera o arquivo inteiro.
          </p>
        )}
      </section>
    </div>
  );
}
