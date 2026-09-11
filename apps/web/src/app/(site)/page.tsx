import type { Metadata } from 'next';
import { ArrowRight, Check, Database, KeyRound, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { estilosBotao } from '@/components/ui/botao';
import { cn } from '@/lib/utils';
import { MODULOS, PASSOS, RECURSOS, RECURSOS_IA } from './conteudo';
import { ComoAIAFunciona, DemonstracaoPrevisao } from './demonstracao-previsao';
import { Grafico3D } from './grafico-3d';
import { Hero } from './hero';
import { Revelar } from './revelar';

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
      <Resultado />
      <ComoFunciona />
      <OQueVemJunto />
      <InteligenciaArtificial />
      <Seguranca />
      <Planos />
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
  const tons = [
    'bg-info-suave text-info',
    'bg-sucesso-suave text-sucesso',
    'bg-atencao-suave text-atencao',
    'bg-destrutivo-suave text-destructive',
    'bg-muted text-foreground',
  ];

  return (
    <section id="recursos" className="scroll-mt-16 border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <CabecalhoSecao rotulo="O que o sistema faz" titulo="Tudo o que o dia a dia pede, junto.">
          Hoje é o WhatsApp para falar com cliente, o caderno para anotar serviço e a planilha para
          as contas. Aqui é um lugar só — e as três coisas conversam entre si.
        </CabecalhoSecao>

        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((recurso, indice) => (
            <article
              key={recurso.titulo}
              className="cartao-elevavel flex flex-col gap-3 rounded-lg p-3"
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-md border border-current/10',
                  tons[indice % tons.length] ?? 'bg-muted text-foreground',
                )}
              >
                <recurso.icone aria-hidden className="size-5" />
              </span>
              <h3 className="font-semibold tracking-tight">{recurso.titulo}</h3>
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
            titulo="No fim do mês, a pergunta é uma só: sobrou quanto?"
          >
            O sistema já sabe responder, porque cada recebimento nasceu ligado ao serviço que o
            gerou e cada custo, ao trabalho que o consumiu. Não é relatório que alguém monta no fim
            do mês — é a conta que se fecha sozinha desde o primeiro lançamento.
          </CabecalhoSecao>

          <ul className="flex flex-col gap-3 text-sm">
            {[
              'Margem por tipo de serviço, não só o total da empresa',
              'Retirada do dono comparada ao que o caixa sustenta',
              'Conta a receber separada do que já entrou de verdade',
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check aria-hidden className="text-sucesso mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-superficie rounded-xl border">
          <Grafico3D />
          <p className="text-muted-foreground border-t px-6 py-3 text-center text-xs">
            Funil, agenda e financeiro no mesmo sistema · dados ilustrativos
          </p>
        </div>
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
        <CabecalhoSecao rotulo="O que vem junto" titulo="Tudo isto já está no sistema hoje.">
          Sem módulo vendido à parte e sem “fale com o comercial”. O que está listado aqui funciona
          desde o primeiro dia da sua conta.
        </CabecalhoSecao>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((modulo) => (
            <article
              key={modulo.nome}
              className="cartao-elevavel bg-card flex flex-col gap-4 rounded-lg border p-6 shadow-[var(--sombra-sutil)]"
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
            <li
              key={passo.titulo}
              className="cartao-elevavel flex flex-col gap-3 border-t p-3 pt-6"
            >
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
                Disponível no Pro
              </span>
            </span>

            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Veja o caixa dos próximos meses antes de tomar a decisão.
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              A conta é do sistema: histórico do que entrou e saiu, mais as contas a pagar e a
              receber que já estão registradas. A IA entra depois — para ler esse cenário, apontar o
              risco e dizer por onde começar.
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
                className="cartao-elevavel bg-card flex flex-col gap-3 rounded-lg border p-5 shadow-[var(--sombra-sutil)]"
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
        <CabecalhoSecao rotulo="Preço" titulo="Escolha o plano certo para organizar sua operação.">
          O Básico organiza a rotina comercial e financeira; o Pro amplia a equipe, a carteira e
          acrescenta previsão financeira com IA.
        </CabecalhoSecao>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <CartaoPlano
            nome="Básico"
            preco="100"
            itens={[
              '2 usuários incluídos',
              'Até 5 usuários · R$ 20 por adicional',
              '500 clientes',
              'CRM, agenda e financeiro',
              'Importação e exportação de dados',
            ]}
          />
          <CartaoPlano
            nome="Pro"
            preco="200"
            destaque
            itens={[
              '5 usuários incluídos',
              'Até 20 usuários · R$ 15 por adicional',
              '3.000 clientes',
              'Tudo do Básico',
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
      className={`cartao-elevavel bg-card flex flex-col gap-6 rounded-lg border p-8 shadow-[var(--sombra-sutil)] ${destaque ? 'border-info/25 ring-info/20 ring-1' : ''}`}
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
