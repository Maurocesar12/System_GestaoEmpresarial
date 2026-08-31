import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

/**
 * Layout das telas de entrada e cadastro.
 *
 * Sem menu nem navegação: quem está aqui ainda não tem sessão, e qualquer link
 * a mais é uma chance de sair do caminho antes de concluir.
 *
 * Duas colunas a partir de telas grandes. A da direita não é enfeite — ela
 * responde "que sistema é esse?" para quem chegou por um link de convite e
 * ainda não conhece o produto. Em telas pequenas ela some, porque aí a única
 * coisa que importa é o formulário.
 */
export default function LayoutAutenticacao({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_28rem]">
      <div className="flex flex-col">
        <header className="px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded text-xs font-bold"
            >
              G
            </span>
            Gestão Empresarial
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      {/*
        O conteúdo fica centralizado como um bloco só. Empurrar o texto para o
        topo e a lista para o rodapé abriria um vão morto no meio da coluna, que
        é o que faz uma tela parecer inacabada.
      */}
      <aside className="bg-superficie hidden flex-col justify-center gap-8 border-l p-10 lg:flex">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-balance">
            O que foi vendido e o que entrou no caixa, no mesmo lugar.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Clientes, funil, orçamentos e agenda conversando com o financeiro — sem planilha
            paralela para fechar o mês.
          </p>
        </div>

        <ul className="flex flex-col gap-3 border-t pt-8 text-sm">
          {[
            'Margem calculada por serviço, não no chute.',
            'Follow-up que sai sozinho, no dia marcado.',
            'Cada empresa enxerga apenas os próprios dados.',
          ].map((item) => (
            <li key={item} className="text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
