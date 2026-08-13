import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão Empresarial',
  description: 'CRM e financeiro no mesmo lugar, para PME de serviço.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` em <html> e <body> por causa de extensões de
    // navegador: várias delas (ColorZilla, Grammarly, gerenciadores de senha)
    // injetam atributos nesses dois elementos antes do React hidratar. O
    // servidor renderiza sem eles, o cliente encontra com eles, e o React
    // reclama de uma diferença que não veio do nosso código.
    //
    // O efeito é raso de propósito: vale só para os atributos destes dois
    // elementos, e não desce pela árvore. Um erro de hidratação de verdade,
    // dentro de qualquer componente, continua sendo reportado normalmente.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
