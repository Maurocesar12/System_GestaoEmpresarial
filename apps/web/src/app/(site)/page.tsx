import type { Metadata } from 'next';
import { ArrowRight, Check, Database, KeyRound, Lock } from 'lucide-react';
import Link from 'next/link';
import { estilosBotao } from '@/components/ui/botao';
import { cn } from '@/lib/utils';
import { DIAS_DE_TESTE, PASSOS, PLANOS, RECURSOS } from './conteudo';
import { PainelDeExemplo } from './painel-de-exemplo';

export const metadata: Metadata = {
  title: 'CRM e financeiro para empresas de serviço',
  description:
    'Clientes, funil, orçamentos e agenda ligados ao financeiro. Saiba a margem de cada serviço sem planilha paralela.',
};

export default function PaginaInicial() {
  return (
    <>
      <Hero />
      <Recursos />
      <ComoFunciona />
      <Seguranca />
      <Planos />
      <ChamadaFinal />
    </>
  );
}

/**
 * Abertura.
 *
 * Alinhada à esquerda, e não centralizada. Texto centralizado obriga o olho a
 * procurar o início de cada linha e é a marca registrada de página feita a
 * partir de template — além de limitar o comprimento do título.
 */
function Hero() {
  return (
    <section className="border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
            Para PME de serviço
          </span>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            O que você vendeu e o que entrou no caixa, no mesmo sistema.
          </h1>

          <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
            CRM e financeiro juntos: o serviço vendido, agendado e executado alimenta o caixa
            sozinho — e você descobre a margem real de cada trabalho, sem manter planilha ao lado.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/cadastro" className={estilosBotao({ tamanho: 'lg' })}>
              Começar teste de {DIAS_DE_TESTE} dias
              <ArrowRight aria-hidden />
            </Link>
            <Link
              href="/entrar"
              className={estilosBotao({ variante: 'secundario', tamanho: 'lg' })}
            >
              Já tenho conta
            </Link>
          </div>

          <p className="text-muted-foreground text-sm">
            Sem cartão para testar. Sua empresa é criada em um passo, com o funil já configurado.
          </p>
        </div>

        <PainelDeExemplo />
      </div>
    </section>
  );
}

/** Rótulo de seção: dá ritmo à página e ajuda a varrer o conteúdo de olho. */
function RotuloSecao({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
      {children}
    </span>
  );
}

function Recursos() {
  return (
    <section id="recursos" className="border-b scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <RotuloSecao>Recursos</RotuloSecao>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Tudo o que a operação precisa, sem seis assinaturas diferentes.
          </h2>
        </div>

        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((recurso) => (
            <article key={recurso.titulo} className="flex flex-col gap-3">
              <recurso.icone aria-hidden className="text-primary size-5" />
              <h3 className="font-semibold tracking-tight">{recurso.titulo}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{recurso.descricao}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComoFunciona() {
  return (
    <section id="como-funciona" className="bg-superficie border-b scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <RotuloSecao>Como funciona</RotuloSecao>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Um dado entra uma vez e atravessa o processo inteiro.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            É essa ligação que permite calcular margem. Quando venda e financeiro moram em sistemas
            separados, alguém precisa reconciliar os dois à mão — e é aí que a conta para de fechar.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="flex flex-col gap-3 border-t pt-6">
              <span className="text-muted-foreground numerico text-sm font-semibold">
                {String(indice + 1).padStart(2, '0')}
              </span>
              <h3 className="font-semibold tracking-tight">{passo.titulo}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{passo.descricao}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const GARANTIAS = [
  {
    icone: Database,
    titulo: 'Isolamento por empresa',
    descricao:
      'Os dados de cada empresa são separados em três camadas, e a última delas é o próprio PostgreSQL: mesmo com o identificador exato em mãos, uma empresa não lê a linha de outra.',
  },
  {
    icone: KeyRound,
    titulo: 'Acesso por papel',
    descricao:
      'Administrador, financeiro, atendente e técnico enxergam coisas diferentes. Você dá acesso ao sistema sem abrir o quanto a empresa fatura.',
  },
  {
    icone: Lock,
    titulo: 'Sessão protegida',
    descricao:
      'Senha guardada com Argon2id, sessão curta renovada automaticamente e token que nunca fica ao alcance de script na página.',
  },
];

/**
 * Seção de segurança.
 *
 * Está na página porque é uma diferença real do produto, não enfeite: quem
 * vende para PME costuma ouvir "meus dados ficam misturados com os de outra
 * empresa?" — e aqui a resposta é verificável.
 */
function Seguranca() {
  return (
    <section id="seguranca" className="border-b scroll-mt-16">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <div className="flex flex-col gap-4">
          <RotuloSecao>Segurança</RotuloSecao>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Dado de cliente e dado de dinheiro no mesmo lugar exigem mais cuidado.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Por isso o isolamento entre empresas foi a primeira coisa construída, antes de qualquer
            tela — e é coberto por testes que tentam ativamente atravessar a fronteira.
          </p>
        </div>

        <ul className="flex flex-col gap-8">
          {GARANTIAS.map((garantia) => (
            <li key={garantia.titulo} className="flex gap-4">
              <garantia.icone aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-1.5">
                <h3 className="font-semibold tracking-tight">{garantia.titulo}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {garantia.descricao}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Planos() {
  return (
    <section id="planos" className="bg-superficie border-b scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <RotuloSecao>Planos</RotuloSecao>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Escolha pelo tamanho da operação, não por recurso bloqueado.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Todos os planos trazem CRM e financeiro completos. O que muda é quantas pessoas usam,
            quantos clientes cabem e quantos lembretes saem por mês.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANOS.map((plano) => (
            <article
              key={plano.slug}
              className={cn(
                'bg-card flex flex-col gap-6 rounded-lg border p-6',
                plano.destaque && 'border-primary shadow-[var(--sombra-media)]',
              )}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold tracking-tight">{plano.nome}</h3>
                  {plano.destaque && (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                      Mais escolhido
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">{plano.resumo}</p>
              </div>

              <p className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground text-sm">R$</span>
                <span className="numerico text-3xl font-semibold tracking-tight">
                  {plano.preco}
                </span>
                <span className="text-muted-foreground text-sm">/mês</span>
              </p>

              <ul className="flex flex-col gap-2.5 text-sm">
                {plano.limites.map((limite) => (
                  <li key={limite} className="flex items-center gap-2.5">
                    <Check aria-hidden className="text-primary size-4 shrink-0" />
                    {limite}
                  </li>
                ))}
              </ul>

              <Link
                href="/cadastro"
                className={cn(
                  estilosBotao({ variante: plano.destaque ? 'primario' : 'secundario' }),
                  'mt-auto w-full',
                )}
              >
                Começar teste
              </Link>
            </article>
          ))}
        </div>

        <p className="text-muted-foreground mt-8 text-sm">
          {DIAS_DE_TESTE} dias para testar, sem cartão. Você escolhe o plano depois de ver o sistema
          rodando com os seus dados.
        </p>
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
      <div className="flex flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
          Comece pelo cadastro da empresa. O resto o sistema já deixa pronto.
        </h2>
        <p className="text-muted-foreground max-w-xl leading-relaxed">
          O funil nasce configurado com as sete etapas mais comuns em serviço. Você ajusta depois,
          se quiser — mas dá para cadastrar o primeiro cliente em seguida.
        </p>
        <Link href="/cadastro" className={estilosBotao({ tamanho: 'lg' })}>
          Criar minha empresa
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
