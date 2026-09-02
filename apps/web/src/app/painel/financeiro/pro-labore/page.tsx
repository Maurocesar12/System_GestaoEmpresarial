import type { Metadata } from 'next';
import { Wallet } from 'lucide-react';
import { formatarBRL, type ProLabore, type SugestaoProLabore } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { FaixaDeIndicadores, Indicador } from '@/components/ui/indicador';
import { Selo } from '@/components/ui/selo';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';
import { formatarDataCompleta } from '@/lib/formatacao';
import { FormularioProLabore } from './formulario-pro-labore';
import { BotaoRemoverVigencia } from './botao-remover-vigencia';

export const metadata: Metadata = {
  title: 'Pró-labore',
};

/** Abaixo disto a média não representa o negócio — oscilou pouco tempo para dizer algo. */
const MESES_MINIMOS = 3;

/**
 * Pró-labore.
 *
 * Responde a pergunta que o dono de PME responde por intuição, e descobre em
 * abril que errou: *quanto posso tirar por mês sem quebrar o caixa?*
 *
 * O teto é mostrado junto com as parcelas que o formam. Um número sozinho seria
 * um palpite com aparência de autoridade; mostrando a conta, o dono pode
 * discordar dela com conhecimento — e é ele quem decide, não o sistema.
 */
export default async function PaginaProLabore() {
  const [sugestao, historico] = await Promise.all([
    apiComSessao<SugestaoProLabore>('/financeiro/pro-labore/sugestao?meses=3'),
    apiComSessao<ProLabore[]>('/financeiro/pro-labore'),
  ]);

  const folga = Number(sugestao.folga);
  const semDefinicao = sugestao.valorVigente === null;

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Pró-labore"
        descricao="Quanto você retira por mês, e quanto o negócio sustenta."
        voltar={{ href: '/painel/financeiro', rotulo: 'Financeiro' }}
      />

      <FaixaDeIndicadores>
        <Indicador
          titulo="Retirada atual"
          valor={semDefinicao ? '—' : formatarBRL(sugestao.valorVigente!)}
          detalhe={semDefinicao ? 'ainda não definida' : 'valor vigente hoje'}
        />
        <Indicador
          titulo="Teto sugerido"
          valor={formatarBRL(sugestao.tetoSugerido)}
          detalhe={`média de ${sugestao.mesesAnalisados} meses fechados`}
          destaque
        />
        <Indicador
          titulo="Folga"
          valor={formatarBRL(sugestao.folga)}
          tom={folga < 0 ? 'negativo' : 'positivo'}
          detalhe={
            semDefinicao
              ? 'defina a retirada para comparar'
              : folga < 0
                ? 'você está retirando acima do teto'
                : 'espaço até o teto'
          }
        />
        <Indicador
          titulo="Receita média"
          valor={formatarBRL(sugestao.mediaReceita)}
          detalhe="do que efetivamente entrou"
        />
      </FaixaDeIndicadores>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo className="flex items-center gap-2">
            <Wallet aria-hidden className="text-muted-foreground size-4" />
            Como o teto foi calculado
          </CartaoTitulo>
        </CartaoCabecalho>

        <CartaoConteudo className="flex flex-col gap-4">
          <ul className="flex flex-col">
            <LinhaDaConta rotulo="Receita média mensal recebida" valor={sugestao.mediaReceita} />
            <LinhaDaConta rotulo="Custo fixo mensal" valor={sugestao.custoFixoMensal} subtrai />
            <LinhaDaConta
              rotulo="Custo variável mensal"
              valor={sugestao.custoVariavelMensal}
              subtrai
            />
            <LinhaDaConta
              rotulo="Aporte sugerido para a reserva"
              valor={sugestao.aporteReservaSugerido}
              subtrai
            />
            <LinhaDaConta rotulo="Teto sugerido" valor={sugestao.tetoSugerido} total />
          </ul>

          <div className="text-muted-foreground flex flex-col gap-2 border-t pt-3 text-xs">
            <p>
              A conta usa o que <strong className="text-foreground">entrou de fato</strong>, e não o
              faturado: dinheiro que ainda não caiu não paga conta nenhuma. O mês corrente fica de
              fora — incluí-lo pela metade puxaria a média para baixo todo dia 1º.
            </p>

            {sugestao.mesesAnalisados < MESES_MINIMOS && (
              <p className="text-atencao">
                A média cobre menos de {MESES_MINIMOS} meses. Faturamento de serviço oscila, então
                trate este teto como indicação frágil até haver mais histórico.
              </p>
            )}
          </div>
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>
            {semDefinicao ? 'Definir pró-labore' : 'Alterar o pró-labore'}
          </CartaoTitulo>
        </CartaoCabecalho>

        <CartaoConteudo>
          <FormularioProLabore sugestao={formatarBRL(sugestao.tetoSugerido)} />
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Histórico</CartaoTitulo>
          <p className="text-muted-foreground shrink-0 text-xs">
            Cada mês é calculado com o valor que valia nele.
          </p>
        </CartaoCabecalho>

        {historico.length === 0 ? (
          <CartaoConteudo>
            <EstadoVazio
              icone={Wallet}
              titulo="Nenhum pró-labore definido"
              descricao="Defina o valor acima para o sistema comparar sua retirada com o que o negócio sustenta."
              className="border-0"
            />
          </CartaoConteudo>
        ) : (
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Vigência</TabelaColuna>
              <TabelaColuna numerica>Valor mensal</TabelaColuna>
              <TabelaColuna numerica>
                <span className="sr-only">Ações</span>
              </TabelaColuna>
            </TabelaCabecalho>

            <TabelaCorpo>
              {historico.map((vigencia) => (
                <TabelaLinha key={vigencia.id}>
                  <TabelaCelula>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">
                        {formatarDataCompleta(vigencia.vigenciaInicio)}
                        {vigencia.vigenciaFim
                          ? ` a ${formatarDataCompleta(vigencia.vigenciaFim)}`
                          : ' — em diante'}
                      </span>

                      {vigencia.vigenciaFim === null && (
                        <Selo tom="sucesso" comPonto>
                          Vigente
                        </Selo>
                      )}
                    </div>
                  </TabelaCelula>

                  <TabelaCelula numerica className="font-medium">
                    {formatarBRL(vigencia.valor)}
                  </TabelaCelula>

                  <TabelaCelula numerica>
                    <BotaoRemoverVigencia id={vigencia.id} />
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        )}
      </Cartao>
    </div>
  );
}

/**
 * Uma parcela da conta do teto.
 *
 * O sinal vai escrito antes do valor — "− R$ 3.200" — porque uma lista de
 * números sem sinal obriga o leitor a adivinhar quais são somados e quais são
 * descontados.
 */
function LinhaDaConta({
  rotulo,
  valor,
  subtrai = false,
  total = false,
}: {
  rotulo: string;
  valor: string;
  subtrai?: boolean;
  total?: boolean;
}) {
  return (
    <li
      className={
        total
          ? 'mt-1 flex items-center justify-between gap-4 border-t pt-2.5 text-sm font-semibold'
          : 'flex items-center justify-between gap-4 py-1.5 text-sm'
      }
    >
      <span className={total ? '' : 'text-muted-foreground'}>{rotulo}</span>
      <span className="tabular-nums">
        {subtrai && '− '}
        {formatarBRL(valor)}
      </span>
    </li>
  );
}
