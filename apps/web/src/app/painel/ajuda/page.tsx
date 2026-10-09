import type { Metadata } from 'next';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { GLOSSARIO, type Conceito, type IdConceito } from '@/lib/glossario';
import { NOME_DO_OPERADOR } from '@/lib/operadores';
import { ExploradorGlossario, type ConceitoComId } from './explorador-glossario';

export const metadata: Metadata = {
  title: 'Entenda os números',
};

/**
 * As contas que mais se repetem, em uma linha cada.
 *
 * A lista de termos responde "o que é isto?"; estas linhas respondem "como as
 * peças se encaixam?". Quem entende que **saldo é entradas menos saídas** e que
 * **margem é receita menos custo** já lê metade das telas do sistema.
 *
 * Um pedaço só vira atalho quando existe um cartão que define **exatamente**
 * aquilo. "Receita" e "Custos" da margem, por exemplo, ficam como texto: levar
 * para o cartão errado seria pior do que não levar. Os atalhos são âncoras
 * comuns (`<a href="#...">`), e não `<Link>`: o navegador rola até o cartão e
 * dispara o `hashchange` que o abre, sem precisar de nada a mais.
 */
interface Relacao {
  titulo: string;
  partes: readonly (
    | { tipo: 'termo'; id: IdConceito; texto: string }
    | { tipo: 'texto'; texto: string }
    | { tipo: 'sinal'; texto: string }
  )[];
}

const termo = (id: IdConceito, texto: string) => ({ tipo: 'termo' as const, id, texto });
const texto = (valor: string) => ({ tipo: 'texto' as const, texto: valor });
const sinal = (valor: string) => ({ tipo: 'sinal' as const, texto: valor });

const RELACOES: readonly Relacao[] = [
  {
    titulo: 'O que sobrou no caixa',
    partes: [
      termo('saldo', 'Saldo'),
      sinal('='),
      termo('entradas', 'Entradas'),
      sinal('−'),
      termo('saidas', 'Saídas'),
    ],
  },
  {
    titulo: 'Quanto um serviço rende',
    partes: [
      termo('margem', 'Margem'),
      sinal('='),
      texto('Receita do serviço'),
      sinal('−'),
      texto('Custos dele'),
    ],
  },
  {
    titulo: 'Quantas propostas fecham',
    partes: [
      termo('taxa-de-conversao', 'Conversão'),
      sinal('='),
      texto('Aprovadas'),
      sinal('÷'),
      texto('Respondidas'),
    ],
  },
  {
    titulo: 'Quanto o negócio custa por dia',
    partes: [
      termo('custo-por-dia', 'Custo por dia'),
      sinal('='),
      termo('custo-fixo', 'Custo fixo por dia'),
      sinal('+'),
      termo('pro-labore', 'Pró-labore por dia'),
    ],
  },
  {
    titulo: 'Quanto dá para retirar',
    partes: [
      termo('teto-pro-labore', 'Teto'),
      sinal('='),
      texto('Receita média'),
      sinal('−'),
      texto('Custos'),
      sinal('−'),
      termo('reserva', 'Reserva'),
    ],
  },
];

/**
 * Glossário do sistema.
 *
 * Fica no menu, mas a ideia é que quase ninguém precise chegar aqui pelo menu:
 * cada "?" nas telas leva direto ao termo certo. Esta página é para quem quer
 * estudar com calma, procurar por palavra ou entender o conjunto.
 *
 * É conteúdo estático — nada é lido da API —, então qualquer pessoa autenticada
 * a abre, mesmo sem acesso ao financeiro: aqui só há definições, nenhum número
 * da empresa.
 */
export default function PaginaAjuda() {
  const conceitos: ConceitoComId[] = Object.entries<Conceito>(GLOSSARIO).map(([id, conceito]) => ({
    id,
    ...conceito,
  }));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Entenda os números"
        descricao="O que cada termo das telas quer dizer, como o sistema chega no valor e como ler."
      />

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>As contas principais, em uma linha</CartaoTitulo>
          <p className="text-muted-foreground hidden shrink-0 text-xs sm:block">
            Clique num termo para ver a explicação.
          </p>
        </CartaoCabecalho>

        <CartaoConteudo>
          <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {RELACOES.map((relacao) => (
              <li key={relacao.titulo} className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-xs font-medium">{relacao.titulo}</p>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                  {relacao.partes.map((parte, indice) => {
                    if (parte.tipo === 'sinal') {
                      return (
                        <span key={indice} className="text-muted-foreground font-medium">
                          <span aria-hidden>{parte.texto}</span>
                          <span className="sr-only">
                            {NOME_DO_OPERADOR[parte.texto as keyof typeof NOME_DO_OPERADOR]}
                          </span>
                        </span>
                      );
                    }

                    if (parte.tipo === 'texto') {
                      return (
                        <span key={indice} className="px-0.5 font-medium">
                          {parte.texto}
                        </span>
                      );
                    }

                    return (
                      <a
                        key={indice}
                        href={`#${parte.id}`}
                        className="bg-muted hover:bg-accent rounded-md px-2 py-0.5 font-medium"
                      >
                        {parte.texto}
                      </a>
                    );
                  })}
                </p>
              </li>
            ))}
          </ul>
        </CartaoConteudo>
      </Cartao>

      <ExploradorGlossario conceitos={conceitos} />
    </div>
  );
}
