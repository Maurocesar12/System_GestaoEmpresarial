import type { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  FileDown,
  KeyRound,
  Lock,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { estilosBotao } from '@/components/ui/botao';
import { cn } from '@/lib/utils';
import { MODULOS, PALAVRAS, PERGUNTAS, RECURSOS, RECURSOS_IA } from './conteudo';
import { ComoAIAFunciona, DemonstracaoPrevisao } from './demonstracao-previsao';
import { JornadaDoServico } from './jornada-do-servico';
import { PainelResultado } from './painel-resultado';
import { Hero } from './hero';
import { Revelar } from './revelar';

export const metadata: Metadata = {
  title: 'Sistema de gestão para empresas de serviço',
  description:
    'Clientes, orçamentos, agenda e dinheiro no mesmo lugar. Veja quanto sobrou de cada serviço, sem montar planilha. 14 dias grátis, sem cartão de crédito.',
};

/**
 * A ordem é a de uma conversa com quem nunca viu o produto: o que é, como
 * funciona na prática, o que isso entrega, as palavras que costumam travar, o
 * que vem junto, a inteligência artificial, a segurança, o preço e, por fim, as
 * dúvidas — que só aparecem depois de a pessoa ter o que perguntar.
 *
 * O "como funciona" vem **antes** do resultado: quem entende o caminho (o
 * dinheiro nasce ligado ao serviço) entende por que a sobra aparece sozinha. Ao
 * contrário, o painel de resultado era um número sem origem.
 */
export default function PaginaInicial() {
  return (
    <>
      <Hero />
      <Recursos />
      <ComoFunciona />
      <Resultado />
      <SemEconomes />
      <OQueVemJunto />
      <InteligenciaArtificial />
      <Seguranca />
      <Planos />
      <Duvidas />
      <ChamadaFinal />
    </>
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
        <CabecalhoSecao
          rotulo="O que é isto"
          titulo="Um sistema para quem vende serviço — e está cansado de juntar tudo na mão."
        >
          Hoje é o WhatsApp para falar com cliente, o caderno para anotar serviço e a planilha para
          as contas. Aqui é um lugar só — e as três coisas conversam entre si: o que você anota num
          canto aparece sozinho nos outros. Veja as seis situações do dia a dia que ele resolve.
        </CabecalhoSecao>

        {/*
          Um acento só para os seis ícones, e não seis cores diferentes.

          Antes cada cartão pegava um tom da paleta semântica, incluindo
          `destrutivo` — o vermelho de erro. No resto do sistema verde é
          sucesso, âmbar é alerta e vermelho é problema; usar esse vocabulário
          como enfeite aqui ensina o oposto, e "o retorno acontece no dia certo"
          pintado de vermelho de erro diz a coisa errada. Como eram cinco tons
          para seis cartões, o último ainda repetia a cor do primeiro e parecia
          descuido.

          A diferenciação que importa já está no ícone e no título. Uma cor só —
          a da marca — deixa a seção mais calma e não promete significado que a
          cor não tem.
        */}
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((recurso) => (
            <article key={recurso.titulo} className="flex flex-col gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md border border-current/10">
                <recurso.icone aria-hidden className="size-5" />
              </span>
              <h3 className="font-semibold tracking-tight">{recurso.titulo}</h3>
              {/* A dúvida vem primeiro: quem se reconhece nela quer ler a resposta. */}
              <p className="text-sm font-medium italic">{recurso.pergunta}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{recurso.descricao}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Demonstra o caminho do orçamento até o resultado financeiro do serviço. */
function Resultado() {
  return (
    <section id="resultado" className="scroll-mt-16 overflow-x-clip border-b">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1fr_1fr] lg:py-24">
        <div className="flex flex-col gap-5">
          <CabecalhoSecao
            rotulo="O resultado"
            titulo="Você sabe quanto sobrou, sem esperar o mês fechar."
          >
            Como você viu no exemplo da Maria, cada recebimento nasce ligado ao serviço que o gerou,
            e cada custo, ao trabalho que o consumiu. Por isso a sobra de cada serviço já está
            calculada: não é relatório que alguém monta no fim do mês, é a conta que vai se fechando
            sozinha a cada serviço registrado.
          </CabecalhoSecao>

          <ul className="flex flex-col gap-4 text-sm">
            {[
              {
                destaque: 'Margem por tipo de serviço, não só o total da empresa.',
                explica: 'Você vê qual serviço compensa e qual dá trabalho e pouco retorno.',
              },
              {
                destaque: 'Retirada do dono comparada ao que o caixa sustenta.',
                explica:
                  'Um limite sugerido para você tirar dinheiro sem deixar a operação no vermelho.',
              },
              {
                destaque: 'Conta a receber separada do que já entrou de verdade.',
                explica: 'O dinheiro prometido não se mistura com o que já está no caixa.',
              },
            ].map((item) => (
              <li key={item.destaque} className="flex gap-3">
                <Check aria-hidden className="text-sucesso mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-medium">{item.destaque}</span>{' '}
                  <span className="text-muted-foreground">{item.explica}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <PainelResultado />
      </div>
    </section>
  );
}

/**
 * O inventário do produto.
 *
 * Os cartões de recurso vendem a ideia; esta seção responde à pergunta que
 * trava a decisão — *"o que exatamente vem junto?"*. Por isso é lista seca,
 * agrupada por módulo, com o que existe hoje e nada do que ainda virá.
 */
function OQueVemJunto() {
  return (
    <section id="incluso" className="scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao
          rotulo="O que vem junto"
          titulo="Nada disso é promessa. Está no sistema hoje."
        >
          Sem módulo vendido à parte e sem “fale com o comercial”. O que está listado aqui funciona
          desde o primeiro dia da sua conta.
        </CabecalhoSecao>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((modulo) => (
            <article
              key={modulo.nome}
              className="cartao-elevavel bg-card flex flex-col gap-4 rounded-lg p-6"
            >
              <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-md border border-current/10">
                <modulo.icone aria-hidden className="size-5" />
              </span>

              <div>
                <h3 className="font-semibold tracking-tight">{modulo.nome}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {modulo.resumo}
                </p>
              </div>

              <ul className="flex flex-col gap-2 border-t pt-4 text-sm">
                {modulo.itens.map((item) => (
                  <li key={item} className="text-muted-foreground flex gap-2.5 leading-relaxed">
                    <Check aria-hidden className="text-sucesso mt-1 size-3.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * A explicação de como o sistema funciona, em forma de história.
 *
 * Antes eram quatro passos abstratos ("chega um cliente… a conta aparece
 * pronta") que serviriam para qualquer sistema do mundo. Agora é um caso
 * concreto, que se abre etapa por etapa: o que a pessoa faz, o que o sistema faz
 * sozinho e o que aparece para ela. A curiosidade está em abrir a próxima
 * etapa — e o convencimento, na coluna do meio.
 */
function ComoFunciona() {
  return (
    <section id="como-funciona" className="bg-superficie scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao
          rotulo="Como funciona"
          titulo="Acompanhe um serviço de ponta a ponta — e veja onde o sistema trabalha por você."
        >
          Vamos seguir a Maria, que quer instalar um ar-condicionado por R$ 980. Em cada etapa
          mostramos o que você faz, o que o sistema faz sozinho e o que aparece para você. No fim,
          você vai ver como nasce a resposta para a pergunta que mais importa: quanto sobrou?
        </CabecalhoSecao>

        <p className="text-muted-foreground mt-8 text-sm font-medium">
          Toque em cada etapa para abrir.
        </p>

        <div className="mt-3 max-w-4xl">
          <JornadaDoServico />
        </div>

        <p className="text-muted-foreground mt-6 max-w-2xl text-sm leading-relaxed">
          O segredo está no meio do caminho: o que você registra em uma etapa já é usado nas
          seguintes. Quando a venda mora num lugar e o dinheiro em outro, alguém precisa juntar os
          dois no fim do mês — e é aí que a conta para de bater.
        </p>
      </div>
    </section>
  );
}

/**
 * As palavras que travam quem não é do ramo.
 *
 * Fica logo depois do resultado, onde "margem", "fluxo de caixa" e
 * "pró-labore" aparecem pela primeira vez em volume. Quem não conhece o termo
 * não pergunta: conclui que o sistema "não é para mim" e vai embora. Aqui cada
 * palavra vem com uma frase e uma conta de cabeça.
 */
function SemEconomes() {
  return (
    <section id="palavras" className="bg-superficie scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao
          rotulo="Sem economês"
          titulo="Seis palavras de finanças, explicadas como numa conversa."
        >
          Você vai vê-las pelo sistema. Dentro dele, cada uma tem um botão “?” ao lado do número,
          que explica na hora o que significa e como é calculado. Aqui vai um adiantamento.
        </CabecalhoSecao>

        <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PALAVRAS.map((palavra) => (
            <div key={palavra.termo} className="bg-card flex flex-col gap-2 rounded-lg border p-5">
              <dt className="font-semibold tracking-tight">{palavra.termo}</dt>
              <dd className="text-sm leading-relaxed">{palavra.significa}</dd>
              <dd className="text-muted-foreground border-t pt-2 text-sm leading-relaxed">
                <span className="text-foreground font-medium">Na prática: </span>
                {palavra.exemplo}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function InteligenciaArtificial() {
  const proximosRecursos = RECURSOS_IA.filter((recurso) => !recurso.disponivel);

  return (
    <section id="ia" className="bg-superficie scroll-mt-16 overflow-hidden border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <Revelar>
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <span className="flex flex-wrap items-center gap-2">
              <RotuloSecao>Previsão financeira com IA</RotuloSecao>
              <span className="bg-sucesso-suave text-sucesso rounded-full px-2 py-0.5 text-xs font-medium">
                Disponível no Premium
              </span>
            </span>

            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Saiba se o caixa aguenta os próximos meses, antes de decidir.
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              A conta é do sistema: histórico do que entrou e saiu, mais as contas a pagar e a
              receber que já estão registradas. A inteligência artificial (IA) entra depois — como
              um analista que lê esse cenário, aponta o risco e diz por onde começar. Mexa nos
              cenários abaixo para ver como o caixa muda.
            </p>
          </div>

          <div className="mt-10">
            <DemonstracaoPrevisao />
          </div>

          {/*
            Os passos vêm depois do gráfico de propósito: primeiro a pessoa vê
            o resultado que interessa a ela, e só então se pergunta como aquilo
            foi parar ali — que é quando a explicação do mecanismo é lida.
          */}
          <div className="mt-12">
            <h3 className="text-xl font-semibold tracking-tight">Como a IA trabalha aqui dentro</h3>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              Em quatro passos, e com a fronteira dos seus dados explícita em cada um.
            </p>

            <div className="mt-8">
              <ComoAIAFunciona />
            </div>
          </div>
        </Revelar>

        <Revelar className="mt-16" atrasoMs={80}>
          <div className="flex max-w-2xl flex-col gap-3">
            <RotuloSecao>Próximos assistentes</RotuloSecao>
            <h3 className="text-2xl font-semibold tracking-tight">
              A inteligência continua crescendo junto com a operação.
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Estes recursos entram nas próximas etapas. Cada ação sensível continuará dependendo da
              confirmação de uma pessoa.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {proximosRecursos.map((recurso) => (
              <article
                key={recurso.titulo}
                className="cartao-elevavel bg-card flex flex-col gap-3 rounded-lg p-5"
              >
                <span className="flex items-center justify-between gap-3">
                  <recurso.icone aria-hidden className="text-info size-5" />
                  <span className="text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium">
                    em breve
                  </span>
                </span>
                <h4 className="font-semibold tracking-tight">{recurso.titulo}</h4>
                <p className="text-muted-foreground text-sm italic">{recurso.pergunta}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{recurso.descricao}</p>
              </article>
            ))}
          </div>
        </Revelar>

        <p className="text-muted-foreground mt-8 flex items-start gap-2.5 text-sm leading-relaxed">
          <Sparkles aria-hidden className="text-info mt-0.5 size-4 shrink-0" />
          <span className="max-w-2xl">
            A IA trabalha sobre totais agregados e não recebe nomes de clientes. As projeções são
            apoio gerencial e não substituem a análise do contador.
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
  {
    icone: Smartphone,
    titulo: 'Entrada em duas etapas',
    descricao:
      'Além da senha, cada pessoa confirma um código gerado por um aplicativo autenticador no celular. Mesmo que alguém descubra a senha, não entra sem o seu aparelho.',
  },
  {
    icone: FileDown,
    titulo: 'Seus dados vão com você',
    descricao:
      'O dono pode exportar tudo da empresa quando quiser. Se cancelar a conta, os dados são apagados em definitivo depois de 30 dias — não ficam guardados “por precaução”.',
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
  // Fundo neutro, e não `bg-superficie`: a seção de IA logo acima já é tingida,
  // e com as duas no mesmo tom elas viravam uma faixa contínua de meia página.
  // A troca de assunto — de "o que a IA faz" para "como seus dados ficam
  // guardados" — perdia o corte visual que separa uma seção da outra.
  return (
    <section id="seguranca" className="scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <CabecalhoSecao
          rotulo="Segurança"
          titulo="Seus dados são só seus. E isso é testado, não prometido."
        >
          A separação entre empresas foi construída antes de qualquer tela, e é verificada de
          propósito — com testes que tentam invadir o dado de outra empresa e precisam falhar.
        </CabecalhoSecao>

        <ul className="flex flex-col gap-8">
          {GARANTIAS.map((garantia) => (
            <li key={garantia.titulo} className="flex gap-4">
              <span className="bg-atencao-suave text-atencao mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-current/10">
                <garantia.icone aria-hidden className="size-5" />
              </span>
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
    <section id="planos" className="scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao rotulo="Preço" titulo="Dois planos. Sem letra miúda, sem pegadinha.">
          O Básico organiza clientes, orçamentos, agenda e financeiro; o Premium comporta mais
          pessoas na equipe e mais clientes, e acrescenta a inteligência artificial sobre os seus
          números. Os 14 dias de teste valem para os dois.
        </CabecalhoSecao>
        <dl className="text-muted-foreground mt-6 grid max-w-3xl gap-3 text-sm leading-relaxed sm:grid-cols-2">
          <div>
            <dt className="text-foreground font-medium">O que é “usuário”?</dt>
            <dd>
              Cada pessoa da sua equipe que entra no sistema com login e senha próprios — você
              decide o que cada uma enxerga.
            </dd>
          </div>
          <div>
            <dt className="text-foreground font-medium">O que é uma “previsão”?</dt>
            <dd>
              Cada vez que você pede à inteligência artificial para projetar o seu caixa dos
              próximos meses.
            </dd>
          </div>
        </dl>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <CartaoPlano
            nome="Básico"
            preco="100"
            itens={[
              '2 usuários incluídos',
              'Até 5 usuários · R$ 20 por adicional',
              '500 clientes',
              'Clientes, orçamentos, agenda e financeiro',
              'Importação e exportação de dados',
            ]}
          />
          {/*
            "Premium", e não "Pro".

            É o nome que o sistema usa de verdade (`seed.ts`, slug
            `profissional`). Vender "Pro" aqui e mostrar "Premium" na conta faz
            a pessoa duvidar de que assinou o que escolheu — e é o tipo de
            divergência que só aparece depois do pagamento.

            O assistente com IA estava faltando na lista: é um diferencial real
            do plano (`iaHabilitada`), e a página cobrava por ele sem citá-lo.
          */}
          <CartaoPlano
            nome="Premium"
            preco="200"
            destaque
            itens={[
              '5 usuários incluídos',
              'Até 20 usuários · R$ 15 por adicional',
              '3.000 clientes',
              'Tudo do Básico',
              'Assistente com IA sobre os seus números',
              'Previsão financeira com IA',
              '200 previsões por mês',
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function CartaoPlano({
  nome,
  preco,
  itens,
  destaque = false,
}: {
  nome: string;
  preco: string;
  itens: string[];
  destaque?: boolean;
}) {
  return (
    <article
      className={cn(
        'cartao-elevavel bg-card flex flex-col gap-6 rounded-lg p-8',
        destaque && 'border-info/25 ring-info/20 ring-1',
      )}
    >
      <div>
        <h3 className="text-xl font-semibold">{nome}</h3>
        <p className="mt-2">
          <span className="text-4xl font-semibold tracking-tight">R$ {preco}</span>
          <span className="text-muted-foreground">/mês</span>
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item} className="flex gap-3 text-sm">
            <Check className="text-sucesso size-4 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href="/cadastro"
        className={estilosBotao({ variante: destaque ? 'primario' : 'secundario', tamanho: 'lg' })}
      >
        Começar agora
        <ArrowRight />
      </Link>
    </article>
  );
}

/**
 * As dúvidas, em sanfona.
 *
 * `<details>` sem `name`: ao contrário da jornada, aqui a pessoa costuma querer
 * ler duas ou três respostas lado a lado, e fechar uma ao abrir a outra seria
 * atrapalhar. Sem JavaScript, e com todo o texto no HTML — o que também ajuda
 * a página a ser encontrada por quem pesquisa a pergunta.
 */
function Duvidas() {
  return (
    <section id="duvidas" className="bg-superficie scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <CabecalhoSecao rotulo="Dúvidas" titulo="O que costumam perguntar antes de testar.">
          Respostas diretas, inclusive sobre o que o sistema ainda não faz. É melhor você saber
          agora do que descobrir depois.
        </CabecalhoSecao>

        <div className="flex flex-col gap-3">
          {PERGUNTAS.map((item) => (
            <details key={item.pergunta} className="group bg-card rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-semibold select-none sm:p-5 [&::-webkit-details-marker]:hidden">
                {item.pergunta}
                <ChevronDown
                  aria-hidden
                  className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="text-muted-foreground border-t p-4 text-sm leading-relaxed sm:p-5">
                {item.resposta}
              </p>
            </details>
          ))}
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
          Quer ver a conta da sua empresa se fechando sozinha?
        </h2>
        <p className="text-muted-foreground max-w-xl leading-relaxed">
          O jeito mais rápido de entender é testar. Cadastre o primeiro cliente e faça um orçamento:
          é o suficiente para o quadro de negociações e o painel começarem a se mexer. O
          acompanhamento já nasce montado, com as etapas que a maioria das empresas de serviço usa —
          dá para ajustar depois.
        </p>
        <div className="flex flex-col items-start gap-2">
          <Link href="/cadastro" className={estilosBotao({ tamanho: 'lg' })}>
            Testar grátis por 14 dias
            <ArrowRight aria-hidden />
          </Link>
          <p className="text-muted-foreground text-xs">
            Sem cartão de crédito · cancele quando quiser
          </p>
        </div>
      </div>
    </section>
  );
}
