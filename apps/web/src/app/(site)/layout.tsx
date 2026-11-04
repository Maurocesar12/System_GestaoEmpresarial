import { Fraunces, Instrument_Sans } from 'next/font/google';
import Link from 'next/link';
import { Marca } from '@/components/marca';
import { SITE } from '@/configuracao/site';
import { NavegacaoMobile } from './navegacao-mobile';
import './site.css';

/**
 * Layout das páginas públicas (a página inicial e a de privacidade).
 *
 * Fica num grupo de rotas `(site)` — os parênteses agrupam sem entrar na URL,
 * então esta pasta continua servindo `/`. O painel tem o próprio layout: aqui
 * não há navegação de sistema, porque quem chega ainda não é usuário.
 *
 * ## Fontes
 *
 * Fraunces (serifada display) nos títulos e Instrument Sans no texto, só nas
 * páginas públicas; o painel segue com a fonte do sistema operacional.
 *
 * Vêm do `next/font`, e não de um `<link>` para o Google Fonts: o `next/font`
 * baixa os arquivos no build e os serve do nosso próprio domínio. A CSP do
 * projeto (`font-src 'self'`, `style-src 'self'`) bloquearia o Google Fonts, e
 * assim nenhum dado do visitante vai para terceiros ao abrir a página. O custo
 * é o build precisar de acesso à internet para buscar as fontes.
 */
const fonteDisplay = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  variable: '--fonte-display',
  display: 'swap',
});

const fonteTexto = Instrument_Sans({
  subsets: ['latin'],
  variable: '--fonte-texto',
  display: 'swap',
});

// Com a barra na frente: o layout também serve `/privacidade`, onde uma âncora
// solta procuraria a seção na página errada.
const SECOES = [
  { href: '/#como-funciona', rotulo: 'Como funciona' },
  { href: '/#ponta-a-ponta', rotulo: 'Ponta a ponta' },
  { href: '/#recursos', rotulo: 'Recursos' },
  { href: '/#seguranca', rotulo: 'Segurança' },
  { href: '/#planos', rotulo: 'Planos' },
  { href: '/#duvidas', rotulo: 'Dúvidas' },
];

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`site ${fonteDisplay.variable} ${fonteTexto.variable} flex min-h-screen flex-col`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-(--cartao-site) focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Pular para o conteúdo
      </a>

      {/*
        Cabeçalho fixo de vidro fosco: o conteúdo passa por baixo e continua
        legível, sem a barra virar um bloco opaco que rouba altura útil.
      */}
      <header className="bg-background/70 sticky top-0 z-40 h-(--altura-cabecalho-site) shrink-0 border-b backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6">
          <Link href="/" aria-label="Página inicial" className="whitespace-nowrap">
            <Marca className="text-sm sm:text-base" />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Seções da página">
            {SECOES.map((secao) => (
              <a
                key={secao.href}
                href={secao.href}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                {secao.rotulo}
              </a>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-5 sm:flex lg:ml-0">
            <Link
              href="/entrar"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Entrar
            </Link>
            <Link href="/cadastro" className="botao botao-acento botao-pequeno">
              Criar conta
            </Link>
          </div>
          <NavegacaoMobile secoes={SECOES} />
        </div>
      </header>

      <main id="conteudo" className="flex-1">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div className="flex max-w-sm flex-col gap-3">
              <Marca className="text-base" />
              <p className="text-muted-foreground text-sm leading-relaxed">{SITE.descricao}</p>
            </div>

            <nav aria-label="Rodapé" className="flex flex-wrap gap-x-7 gap-y-2 text-sm">
              <Link href="/privacidade" className="text-muted-foreground hover:text-foreground">
                Privacidade
              </Link>
              <Link href="/entrar" className="text-muted-foreground hover:text-foreground">
                Entrar
              </Link>
              <Link href="/cadastro" className="text-muted-foreground hover:text-foreground">
                Criar conta
              </Link>
            </nav>
          </div>

          <p className="text-muted-foreground border-t pt-6 text-xs">
            © {new Date().getFullYear()} {SITE.nome}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
