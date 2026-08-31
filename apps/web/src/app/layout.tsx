import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
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
  title: {
    default: 'Gestão Empresarial',
    // As páginas definem só o próprio nome; o sufixo é montado aqui, num lugar
    // só, em vez de repetido em cada `metadata`.
    template: '%s · Gestão Empresarial',
  },
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
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/*
          Aplica o tema salvo antes da primeira pintura. Precisa ser inline e
          síncrono: qualquer alternativa chega depois do primeiro quadro, e o
          usuário vê a tela piscar do claro para o escuro.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
