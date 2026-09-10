'use client';

import { useState, useTransition } from 'react';
import { Calculator, PiggyBank, TrendingUp } from 'lucide-react';
import {
  ROTULO_MOVIMENTO_RESERVA,
  formatarBRL,
  normalizarDinheiro,
  type Reserva,
} from '@gestao/shared-types';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Selecao } from '@/components/ui/selecao';
import { movimentarReserva, removerReserva, salvarReserva } from './acoes';

const PERIODOS_PREVISAO = [3, 6, 12, 18, 24, 36] as const;

/**
 * As reservas e o que se faz com elas.
 *
 * Cliente porque cada cartão tem estado próprio — qual está aberto para
 * movimentação, qual está em confirmação de exclusão. Manter isso no servidor
 * exigiria um parâmetro de URL por cartão.
 */
export function GerenciadorReservas({
  reservas,
  custoFixoMensal,
}: {
  reservas: Reserva[];
  custoFixoMensal: string;
}) {
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
            <CartaoReserva
              key={reserva.id}
              reserva={reserva}
              custoFixoMensal={custoFixoMensal}
              aoFalhar={setErro}
            />
          ))}
        </div>
      )}

      <NovaReserva aoFalhar={setErro} />
    </div>
  );
}

function CartaoReserva({
  reserva,
  custoFixoMensal,
  aoFalhar,
}: {
  reserva: Reserva;
  custoFixoMensal: string;
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

        <PrevisaoReserva reserva={reserva} custoFixoMensal={custoFixoMensal} />

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

function PrevisaoReserva({
  reserva,
  custoFixoMensal,
}: {
  reserva: Reserva;
  custoFixoMensal: string;
}) {
  const [aporteMensal, setAporteMensal] = useState(() => aporteInicial(reserva));
  const [meses, setMeses] = useState('12');

  const mesesProjetados = Number(meses);
  const saldoAtual = paraCentavos(reserva.valorAtual) ?? 0;
  const aporte = paraCentavos(aporteMensal) ?? 0;
  const meta = reserva.meta ? paraCentavos(reserva.meta) : null;
  const custoFixo = paraCentavos(custoFixoMensal) ?? 0;

  const totalAportado = Math.max(0, aporte) * mesesProjetados;
  const saldoPrevisto = saldoAtual + totalAportado;
  const faltaParaMeta = meta === null ? null : Math.max(0, meta - saldoPrevisto);
  const mesesParaMeta =
    meta !== null && aporte > 0 && saldoAtual < meta
      ? Math.ceil((meta - saldoAtual) / aporte)
      : null;
  const coberturaPrevista = custoFixo > 0 ? saldoPrevisto / custoFixo : null;

  return (
    <section className="rounded-lg border bg-muted/30 p-3 shadow-[var(--sombra-sutil)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-card shadow-[var(--sombra-sutil)]">
            <Calculator className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Previsão da reserva</p>
            <p className="text-muted-foreground text-xs">Simule sem alterar o saldo.</p>
          </div>
        </div>
        <TrendingUp className="text-muted-foreground size-4" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo
          name={`aporte-${reserva.id}`}
          rotulo="Guardar por mês"
          inputMode="decimal"
          value={aporteMensal}
          onChange={(evento) => setAporteMensal(evento.target.value)}
          placeholder="0,00"
        />
        <Selecao
          name={`periodo-${reserva.id}`}
          rotulo="Tempo da previsão"
          value={meses}
          onChange={(evento) => setMeses(evento.target.value)}
        >
          {PERIODOS_PREVISAO.map((periodo) => (
            <option key={periodo} value={periodo}>
              {periodo} meses
            </option>
          ))}
        </Selecao>
      </div>

      <div className="mt-3 rounded-md border bg-card p-3">
        <p className="text-muted-foreground text-xs">Saldo previsto em {mesesProjetados} meses</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {formatarBRL(paraDinheiro(saldoPrevisto))}
        </p>
        <div className="text-muted-foreground mt-2 grid gap-1 text-xs sm:grid-cols-2">
          <p>Aportes: {formatarBRL(paraDinheiro(totalAportado))}</p>
          <p>
            {coberturaPrevista === null
              ? 'Cobertura: sem custo fixo'
              : `Cobertura: ${coberturaPrevista.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })} meses`}
          </p>
        </div>
      </div>

      {meta !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {faltaParaMeta === 0
            ? 'Nesse ritmo, a meta será alcançada dentro do período escolhido.'
            : `${formatarBRL(paraDinheiro(faltaParaMeta ?? 0))} ainda faltam para a meta${
                mesesParaMeta ? `; no ritmo atual, levaria cerca de ${mesesParaMeta} meses.` : '.'
              }`}
        </p>
      )}
    </section>
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

function aporteInicial(reserva: Reserva): string {
  const saldoAtual = paraCentavos(reserva.valorAtual) ?? 0;
  const meta = reserva.meta ? paraCentavos(reserva.meta) : null;

  if (meta !== null && meta > saldoAtual) {
    return paraDinheiro(Math.ceil((meta - saldoAtual) / 12)).replace('.', ',');
  }

  return '500,00';
}

function paraCentavos(valor: string): number | null {
  const normalizado = normalizarDinheiro(valor);

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizado)) {
    return null;
  }

  const negativo = normalizado.startsWith('-');
  const [inteiros = '0', decimais = ''] = normalizado.replace('-', '').split('.');
  const centavos = Number(inteiros) * 100 + Number(decimais.padEnd(2, '0').slice(0, 2));

  return negativo ? -centavos : centavos;
}

function paraDinheiro(centavos: number): string {
  const valor = Math.max(0, Math.round(centavos));

  return `${Math.floor(valor / 100)}.${String(valor % 100).padStart(2, '0')}`;
}
