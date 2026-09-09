import type { Metadata, Viewport } from 'next';
import { SITE } from '@/configuracao/site';
import './globals.css';

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
  colorScheme: 'light',
  themeColor: SITE.corFundo,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      {/*
        Algumas extensões (ColorZilla, Grammarly e gerenciadores de senha)
        injetam atributos no body antes da hidratação. O aviso é suprimido apenas
        neste elemento; divergências dentro da aplicação continuam visíveis.

        Por exemplo, o ColorZilla escreve `cz-shortcut-listen="true"`. O React
        compararia esse atributo com o HTML do servidor e reportaria uma
        diferença que não nasceu no sistema.
      */}
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
