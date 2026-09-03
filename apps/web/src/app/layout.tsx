import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SITE } from '@/configuracao/site';
import { SCRIPT_TEMA } from '@/lib/tema';
import './globals.css';

/**
 * Tipografia do sistema.
 *
 * Inter foi desenhada para texto de interface em tela: altura de x generosa,
 * letras abertas e — o que importa aqui — algarismos de largura fixa
 * disponíveis, que é o que mantém uma coluna de valores alinhada.
 *
 * Servida pelo `next/font`, os arquivos são baixados no build e passam a ser
 * entregues pelo nosso próprio domínio. Não há requisição ao Google em tempo
 * de execução (nada de dado do usuário vaza para lá, o que também simplifica o
 * lado de LGPD) e não existe o "pulo" de fonte no primeiro carregamento.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fonte-sans',
});

export const metadata: Metadata = {
  metadataBase: SITE.url,
  applicationName: SITE.nome,
  title: {
    default: SITE.nome,
    template: `%s · ${SITE.nome}`,
  },
  description: SITE.descricao,
  keywords: ['CRM', 'gestão empresarial', 'financeiro', 'PME', 'empresas de serviço'],
  creator: SITE.nome,
  category: 'business',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    siteName: SITE.nome,
    title: SITE.nome,
    description: SITE.descricao,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.nome,
    description: SITE.descricao,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: SITE.corFundo },
    { media: '(prefers-color-scheme: dark)', color: SITE.corFundoEscuro },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` nos DOIS elementos, e por dois motivos
    // diferentes:
    //
    // No `<html>`, porque o script de tema troca a classe antes de o React
    // hidratar — o servidor renderiza sem `.dark`, o navegador já encontra com.
    //
    // No `<body>`, por causa de extensão de navegador. Várias delas (ColorZilla,
    // Grammarly, gerenciadores de senha) injetam atributo ali antes da
    // hidratação: o ColorZilla escreve `cz-shortcut-listen="true"`. O React
    // compara, encontra um atributo que não veio do servidor e reclama de uma
    // diferença que não nasceu no nosso código.
    //
    // O efeito é raso de propósito: vale só para os atributos destes dois
    // elementos, e não desce pela árvore. Um erro de hidratação de verdade,
    // dentro de qualquer componente, continua sendo reportado normalmente.
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/*
          Aplica o tema salvo antes da primeira pintura. Precisa ser inline e
          síncrono: qualquer alternativa chega depois do primeiro quadro, e o
          usuário vê a tela piscar do claro para o escuro.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      {/*
        Sem provider de cliente em volta da árvore.

        Havia um `QueryClientProvider` aqui, mas nenhum componente do sistema
        chama `useQuery`: os dados vêm de Server Components e as escritas de
        Server Actions. O provider era JavaScript baixado, executado e hidratado
        em toda página para não fazer nada — e, por ser um componente de
        cliente, forçava uma fronteira de cliente na raiz da aplicação.

        Se um dia houver busca incremental no navegador (rolagem infinita,
        atualização em segundo plano), ele volta — envolvendo só a parte que
        precisar, não o `<body>` inteiro.
      */}
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
