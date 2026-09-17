'use client';

import { formatarBRL, normalizarQuantidade } from '@gestao/shared-types';
import { estilosControle } from '@/components/ui/campo';
import { cn } from '@/lib/utils';

export interface MaterialDoCatalogo {
  id: string;
  nome: string;
  unidade: string;
  custoMedio: string;
}

export interface LinhaMaterial {
  materialId: string;
  /** Como a pessoa digita: "1,5". */
  quantidade: string;
}

function numero(valor: string): number {
  const convertido = Number(normalizarQuantidade(valor));
  return Number.isFinite(convertido) ? convertido : 0;
}

/**
 * Lista editável de materiais, usada na lista padrão do serviço e na
 * conferência da execução.
 *
 * O custo mostrado é estimativa pelo custo médio de agora, só para orientar:
 * o valor que entra na margem é calculado pela API no momento da baixa.
 */
export function EditorMateriais({
  catalogo,
  linhas,
  aoMudar,
  desabilitado = false,
}: {
  catalogo: MaterialDoCatalogo[];
  linhas: LinhaMaterial[];
  aoMudar: (linhas: LinhaMaterial[]) => void;
  desabilitado?: boolean;
}) {
  const porId = new Map(catalogo.map((material) => [material.id, material]));
  const usados = new Set(linhas.map((linha) => linha.materialId));
  const disponiveis = catalogo.filter((material) => !usados.has(material.id));

  const custoDaLinha = (linha: LinhaMaterial) =>
    numero(linha.quantidade) * Number(porId.get(linha.materialId)?.custoMedio ?? 0);
  const total = linhas.reduce((soma, linha) => soma + custoDaLinha(linha), 0);

  return (
    <div className="flex flex-col gap-3">
      {linhas.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum material na lista.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.map((linha, indice) => {
            const material = porId.get(linha.materialId);

            return (
              <li key={linha.materialId} className="flex flex-wrap items-center gap-2">
                <span className="min-w-40 flex-1 text-sm">{material?.nome ?? 'Material'}</span>
                <input
                  aria-label={`Quantidade de ${material?.nome ?? 'material'}`}
                  inputMode="decimal"
                  value={linha.quantidade}
                  disabled={desabilitado}
                  onChange={(evento) =>
                    aoMudar(
                      linhas.map((atual, posicao) =>
                        posicao === indice ? { ...atual, quantidade: evento.target.value } : atual,
                      ),
                    )
                  }
                  className={cn(estilosControle, 'h-9 w-24 text-right')}
                />
                <span className="text-muted-foreground w-10 text-xs">{material?.unidade}</span>
                <span className="text-muted-foreground w-24 text-right text-xs tabular-nums">
                  {formatarBRL(custoDaLinha(linha).toFixed(2))}
                </span>
                <button
                  type="button"
                  disabled={desabilitado}
                  onClick={() => aoMudar(linhas.filter((_, posicao) => posicao !== indice))}
                  className="text-destructive text-xs hover:underline disabled:opacity-50"
                >
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {disponiveis.length > 0 && (
        <select
          aria-label="Adicionar material"
          value=""
          disabled={desabilitado}
          onChange={(evento) => {
            if (evento.target.value) {
              aoMudar([...linhas, { materialId: evento.target.value, quantidade: '1' }]);
            }
          }}
          className={cn(estilosControle, 'h-9 w-full cursor-pointer sm:w-72')}
        >
          <option value="">+ Adicionar material…</option>
          {disponiveis.map((material) => (
            <option key={material.id} value={material.id}>
              {material.nome} ({material.unidade})
            </option>
          ))}
        </select>
      )}

      <p className="text-muted-foreground text-xs">
        Custo estimado pelo custo médio atual: {formatarBRL(total.toFixed(2))}
      </p>
    </div>
  );
}
