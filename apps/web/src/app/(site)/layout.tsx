import Link from 'next/link';
import { Marca } from '@/components/marca';
import { estilosBotao } from '@/components/ui/botao';
import { AlternadorTema } from '@/components/ui/tema';
import { SITE } from '@/configuracao/site';

/**
 * Layout das páginas públicas.
 *
 * Fica num grupo de rotas `(site)` — os parênteses agrupam sem entrar na URL,
 * então esta pasta continua servindo `/`. O motivo de existir é o que vem a
 * seguir: recursos, planos e contato vão precisar do mesmo cabeçalho e rodapé,
 * e é melhor que eles nasçam num lugar só do que sejam copiados na terceira
 * página.
 *
 * O painel tem o próprio layout, com a lateral. Aqui não há navegação de
 * sistema: quem chega nesta página ainda não é usuário.
 */

const SECOES = [
  { href: '#recursos', rotulo: 'O que faz' },
  { href: '#como-funciona', rotulo: 'Como funciona' },
  { href: '#ia', rotulo: 'Inteligência artificial' },
  { href: '#seguranca', rotulo: 'Segurança' },
  { href: '#planos', rotulo: 'Planos' },
];

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/*
        Cabeçalho fixo com fundo translúcido: o conteúdo passa por baixo e
        continua legível, sem a barra virar um bloco opaco que rouba altura útil
        em notebook de tela baixa.
      */}
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        {/*
          Padding menor no celular: a 390px, o nome da marca mais os dois botões
          não cabem com `px-6`, e o nome quebrava em duas linhas.
        */}
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6">
          <Link href="/" aria-label="Página inicial" className="whitespace-nowrap">
            <Marca className="text-sm sm:text-base" />
          </Link>

          {/*
            Escondida abaixo de `lg`: com "Inteligência artificial" no meio, as
            quatro âncoras deixam de caber em tablet sem espremer os botões de
            entrar e criar conta, que são o que a página existe para oferecer.
          */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Seções da página">
            {SECOES.map((secao) => (
              <a
                key={secao.href}
                href={secao.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {secao.rotulo}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/entrar" className={estilosBotao({ variante: 'sutil', tamanho: 'sm' })}>
              Entrar
            </Link>
            <Link href="/cadastro" className={estilosBotao({ tamanho: 'sm' })}>
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-superficie border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Marca className="text-sm" />
              <span className="text-muted-foreground text-xs">
                Sistema de Gestão para empresas.
              </span>
            </div>

            <AlternadorTema />
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-xs">
            <span>
              © {new Date().getFullYear()} {SITE.nome}. Todos os direitos reservados.
            </span>

            <div className="flex gap-5">
              <Link href="/entrar" className="hover:text-foreground transition-colors">
                Entrar
              </Link>
              <Link href="/cadastro" className="hover:text-foreground transition-colors">
                Criar conta
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
