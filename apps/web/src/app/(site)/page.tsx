import type { Metadata } from 'next';
import { ArrowRight, Check, Database, KeyRound, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { estilosBotao } from '@/components/ui/botao';
import { DIAS_DE_TESTE, INCLUIDO_NO_TESTE, PASSOS, RECURSOS, RECURSOS_IA } from './conteudo';
import { PainelDeExemplo } from './painel-de-exemplo';

export const metadata: Metadata = {
  title: 'CRM e financeiro para empresas de serviço',
  description:
    'Clientes, orçamentos e agenda ligados ao caixa. Descubra quanto cada serviço realmente deixa de lucro, sem manter planilha do lado.',
};

export default function PaginaInicial() {
  return (
    <>
      <Hero />
      <Recursos />
      <ComoFunciona />
      <InteligenciaArtificial />
      <Seguranca />
      <Teste />
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
            Para quem vende serviço
          </span>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Descubra quais serviços seus realmente dão lucro.
          </h1>

          <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
            Seus clientes, orçamentos e agenda num lugar só — e ligados ao dinheiro que entra e sai.
            No fim do mês você não precisa fechar planilha: a conta de cada trabalho já está feita.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/cadastro" className={estilosBotao({ tamanho: 'lg' })}>
              Testar {DIAS_DE_TESTE} dias de graça
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
            Não pedimos cartão. Você cria a empresa em um passo e já pode cadastrar o primeiro
            cliente.
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

/** Cabeçalho de seção: rótulo, título e um parágrafo opcional. */
function CabecalhoSecao({
  rotulo,
  titulo,
  children,
}: {
  rotulo: string;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <RotuloSecao>{rotulo}</RotuloSecao>
      <h2 className="text-3xl font-semibold tracking-tight text-balance">{titulo}</h2>
      {children && <p className="text-muted-foreground leading-relaxed">{children}</p>}
    </div>
  );
}

function Recursos() {
  return (
    <section id="recursos" className="scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao rotulo="O que o sistema faz" titulo="Tudo o que o dia a dia pede, junto.">
          Hoje é o WhatsApp para falar com cliente, o caderno para anotar serviço e a planilha para
          as contas. Aqui é um lugar só — e as três coisas conversam entre si.
        </CabecalhoSecao>

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
    <section id="como-funciona" className="bg-superficie scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao
          rotulo="Como funciona"
          titulo="Você digita uma vez. O sistema usa o resto do caminho."
        >
          É essa ligação que faz a conta fechar sozinha. Quando a venda mora num lugar e o dinheiro
          em outro, alguém precisa juntar os dois no fim do mês — e é aí que a conta para de bater.
        </CabecalhoSecao>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="flex flex-col gap-3 border-t pt-6">
              <span className="text-muted-foreground text-sm font-semibold tabular-nums">
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

/**
 * Inteligência artificial.
 *
 * ## Por que a seção diz "em breve" em toda parte
 *
 * Nada aqui está pronto. Escondê-lo atrás de verbo no presente renderia mais
 * cadastros e um estrago maior: quem assina esperando conversar com a IA e não
 * encontra nada cancela na primeira hora, conta para os outros e não volta.
 *
 * O aviso aparece três vezes — no rótulo, no parágrafo de abertura e em cada
 * cartão — porque a pessoa raramente lê a página inteira. Ela varre, e precisa
 * bater o olho em qualquer ponto e entender que isso é o que vem por aí.
 */
function InteligenciaArtificial() {
  return (
    <section id="ia" className="scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <span className="flex items-center gap-2">
            <RotuloSecao>Inteligência artificial</RotuloSecao>
            <span className="bg-atencao-suave text-atencao rounded-full px-2 py-0.5 text-xs font-medium">
              Em desenvolvimento
            </span>
          </span>

          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            O sistema vai passar a responder, não só guardar.
          </h2>

          <p className="text-muted-foreground leading-relaxed">
            Estes recursos <strong className="text-foreground">ainda não estão no ar</strong> — são
            o que estamos construindo agora. A ideia é simples: você já alimenta o sistema com o seu
            dia a dia, então ele deveria conseguir responder o que você faria perguntando ao
            contador.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {RECURSOS_IA.map((recurso) => (
            <article
              key={recurso.titulo}
              className="bg-card flex flex-col gap-3 rounded-lg border p-6 shadow-[var(--sombra-sutil)]"
            >
              <span className="flex items-center justify-between gap-3">
                <recurso.icone aria-hidden className="text-primary size-5" />
                <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium">
                  em breve
                </span>
              </span>

              <h3 className="font-semibold tracking-tight">{recurso.titulo}</h3>

              {/* A pergunta do dono, nas palavras dele. É o que faz a pessoa se
                  reconhecer antes de ler a explicação técnica. */}
              <p className="text-muted-foreground text-sm italic">{recurso.pergunta}</p>

              <p className="text-muted-foreground text-sm leading-relaxed">{recurso.descricao}</p>
            </article>
          ))}
        </div>

        <p className="text-muted-foreground mt-8 flex items-start gap-2.5 text-sm leading-relaxed">
          <Sparkles aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
          <span className="max-w-2xl">
            Quem entrar agora ajuda a decidir o que vem primeiro. Se um desses recursos resolveria
            um problema seu, diga — a ordem ainda não está fechada.
          </span>
        </p>
      </div>
    </section>
  );
}

const GARANTIAS = [
  {
    icone: Database,
    titulo: 'Os dados da sua empresa são só seus',
    descricao:
      'Nenhuma outra empresa consegue ver o que é seu. Essa separação foi a primeira coisa construída, antes de qualquer tela, e o próprio banco de dados recusa o acesso — não depende de ninguém lembrar de checar.',
  },
  {
    icone: KeyRound,
    titulo: 'Cada pessoa vê o que precisa',
    descricao:
      'Você libera o sistema para a equipe sem abrir quanto a empresa fatura. Quem atende cliente enxerga o atendimento; o financeiro fica com quem você escolher.',
  },
  {
    icone: Lock,
    titulo: 'Senha e acesso protegidos',
    descricao:
      'Sua senha é guardada de forma que nem nós conseguimos ler, e a sessão se renova sozinha sem deixar brecha aberta no navegador.',
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
    <section id="seguranca" className="bg-superficie scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <CabecalhoSecao
          rotulo="Segurança"
          titulo="Dado de cliente e dinheiro no mesmo lugar pedem mais cuidado."
        >
          Por isso a separação entre empresas foi construída antes de tudo, e é testada de propósito
          — com testes que tentam invadir o dado de outra empresa e precisam falhar.
        </CabecalhoSecao>

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

/**
 * O período de teste, no lugar da tabela de preços.
 *
 * Os valores ainda não estão definidos (arquitetura §12). Anunciar um preço que
 * vai mudar é pior do que não anunciar nenhum: quem contrata por um valor e
 * recebe outro não reclama, some — e leva junto a confiança de quem ele contou.
 *
 * Quando os planos forem fechados, esta seção volta a ser uma tabela.
 */
function Teste() {
  return (
    <section id="planos" className="scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <CabecalhoSecao
          rotulo="Preço"
          titulo={`Experimente ${DIAS_DE_TESTE} dias antes de qualquer conversa sobre valor.`}
        >
          Ainda estamos fechando os planos, e preferimos definir o preço ouvindo quem está usando.
          Enquanto isso, o sistema fica liberado por inteiro — sem recurso escondido atrás de plano
          melhor.
        </CabecalhoSecao>

        <div className="bg-card flex flex-col gap-6 rounded-lg border p-8 shadow-[var(--sombra-sutil)]">
          <ul className="flex flex-col gap-3.5">
            {INCLUIDO_NO_TESTE.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <Link href="/cadastro" className={estilosBotao({ tamanho: 'lg' })}>
            Começar agora
            <ArrowRight aria-hidden />
          </Link>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Quando os planos saírem, avisamos com antecedência. Ninguém é cobrado sem escolher
            continuar.
          </p>
        </div>
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
      <div className="flex flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
          Comece cadastrando sua empresa. O resto já vem pronto.
        </h2>
        <p className="text-muted-foreground max-w-xl leading-relaxed">
          O acompanhamento de negociações já nasce montado, com as etapas que a maioria das empresas
          de serviço usa. Dá para ajustar depois — mas você pode cadastrar o primeiro cliente agora
          mesmo.
        </p>
        <Link href="/cadastro" className={estilosBotao({ tamanho: 'lg' })}>
          Criar minha empresa
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
