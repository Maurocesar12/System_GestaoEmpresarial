'use client';

import { useState, useTransition } from 'react';
import { PiggyBank } from 'lucide-react';
import { ROTULO_MOVIMENTO_RESERVA, formatarBRL, type Reserva } from '@gestao/shared-types';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { movimentarReserva, removerReserva, salvarReserva } from './acoes';

/**
 * As reservas e o que se faz com elas.
 *
 * Cliente porque cada cartão tem estado próprio — qual está aberto para
 * movimentação, qual está em confirmação de exclusão. Manter isso no servidor
 * exigiria um parâmetro de URL por cartão.
 */
export function GerenciadorReservas({ reservas }: { reservas: Reserva[] }) {
  const [erro, setErro] = useState<string>();

  return (
    <div className="flex flex-col gap-4">
      {erro && <AvisoErro mensagem={erro} />}

      {reservas.length === 0 ? (
        <EstadoVazio
          icone={PiggyBank}
          titulo="Nenhuma reserva criada"
          descricao="Crie uma reserva abaixo para acompanhar quantos meses a empresa aguenta parada."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reservas.map((reserva) => (
            <CartaoReserva key={reserva.id} reserva={reserva} aoFalhar={setErro} />
          ))}
        </div>
      )}

      <NovaReserva aoFalhar={setErro} />
    </div>
  );
}

function CartaoReserva({
  reserva,
  aoFalhar,
}: {
  reserva: Reserva;
  aoFalhar: (mensagem: string) => void;
}) {
  const [movimentando, setMovimentando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [processando, iniciar] = useTransition();

  // Passa de 100 quando o dono guardou além da meta. A barra trava em 100 para
  // não estourar a caixa, mas o número ao lado mostra o valor real.
  const progresso = Math.min(reserva.percentualDaMeta ?? 0, 100);

  return (
    <Cartao className="flex flex-col">
      <CartaoCabecalho>
        <CartaoTitulo>{reserva.nome}</CartaoTitulo>

        {reserva.percentualDaMeta !== null && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {reserva.percentualDaMeta}% da meta
          </span>
        )}
      </CartaoCabecalho>

      <CartaoConteudo className="flex flex-1 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatarBRL(reserva.valorAtual)}
          </p>

          {reserva.meta && (
            <p className="text-muted-foreground text-xs tabular-nums">
              meta {formatarBRL(reserva.meta)}
            </p>
          )}
        </div>

        {reserva.meta && (
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso de ${reserva.nome}`}
          >
            <div
              className={progresso >= 100 ? 'bg-sucesso h-full' : 'bg-grafico-1 h-full'}
              style={{ width: `${progresso}%` }}
            />
          </div>
        )}

        {movimentando ? (
          <form
            className="flex flex-col gap-3 border-t pt-3"
            action={(dados) => {
              iniciar(async () => {
                const resultado = await movimentarReserva(reserva.id, {
                  tipo: dados.get('tipo') === 'resgate' ? 'resgate' : 'aporte',
                  valor: String(dados.get('valor') ?? ''),
                });

                if (resultado.erro) {
                  aoFalhar(resultado.erro);
                  return;
                }

                setMovimentando(false);
              });
            }}
          >
            <Campo name="valor" rotulo="Valor" inputMode="decimal" placeholder="0,00" required />

            <div className="flex flex-wrap gap-2">
              <Botao type="submit" name="tipo" value="aporte" tamanho="sm" carregando={processando}>
                {ROTULO_MOVIMENTO_RESERVA.aporte}
              </Botao>

              <Botao
                type="submit"
                name="tipo"
                value="resgate"
                variante="secundario"
                tamanho="sm"
                carregando={processando}
              >
                {ROTULO_MOVIMENTO_RESERVA.resgate}
              </Botao>

              <Botao
                type="button"
                variante="sutil"
                tamanho="sm"
                onClick={() => setMovimentando(false)}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
            <Botao variante="secundario" tamanho="sm" onClick={() => setMovimentando(true)}>
              Guardar ou resgatar
            </Botao>

            {confirmandoExclusao ? (
              <>
                <Botao
                  variante="perigo"
                  tamanho="sm"
                  carregando={processando}
                  onClick={() =>
                    iniciar(async () => {
                      const resultado = await removerReserva(reserva.id);
                      if (resultado.erro) aoFalhar(resultado.erro);
                    })
                  }
                >
                  Confirmar exclusão
                </Botao>

                <Botao variante="sutil" tamanho="sm" onClick={() => setConfirmandoExclusao(false)}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao variante="sutil" tamanho="sm" onClick={() => setConfirmandoExclusao(true)}>
                Excluir
              </Botao>
            )}
          </div>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

function NovaReserva({ aoFalhar }: { aoFalhar: (mensagem: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, iniciar] = useTransition();

  if (!aberto) {
    return (
      <Botao variante="secundario" className="w-fit" onClick={() => setAberto(true)}>
        Nova reserva
      </Botao>
    );
  }

  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>Nova reserva</CartaoTitulo>
      </CartaoCabecalho>

      <CartaoConteudo>
        <form
          className="flex flex-col gap-4"
          action={(dados) => {
            iniciar(async () => {
              const resultado = await salvarReserva(null, {
                nome: String(dados.get('nome') ?? ''),
                valorAtual: String(dados.get('valorAtual') ?? ''),
                meta: String(dados.get('meta') ?? ''),
              });

              if (resultado.erro) {
                aoFalhar(resultado.erro);
                return;
              }

              setAberto(false);
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              name="nome"
              rotulo="Nome"
              placeholder="Fundo de emergência"
              required
              maxLength={60}
            />
            <Campo
              name="valorAtual"
              rotulo="Já guardado"
              inputMode="decimal"
              placeholder="0,00"
              required
            />
            <Campo
              name="meta"
              rotulo="Meta"
              inputMode="decimal"
              placeholder="0,00"
              ajuda="Opcional."
            />
          </div>

          <div className="flex gap-2">
            <Botao type="submit" carregando={salvando}>
              Criar reserva
            </Botao>
            <Botao type="button" variante="sutil" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      </CartaoConteudo>
    </Cartao>
  );
}
