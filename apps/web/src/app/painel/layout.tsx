import type { UsuarioAutenticado } from '@gestao/shared-types';
import type { Metadata } from 'next';
import { ServerCrash } from 'lucide-react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { ShellPainel } from '@/components/painel/shell-painel';
import { ProvedorDeAvisos } from '@/components/ui/avisos';
import { estilosBotao } from '@/components/ui/botao';
import { apiComSessao } from '@/lib/api-servidor';
import { sair } from '../(auth)/acoes';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout da área autenticada.
 *
 * Busca o usuário no servidor a cada carregamento, em vez de guardá-lo no
 * navegador. É uma requisição a mais, e em troca não existe cópia de dados de
 * sessão fora do cookie — nada para ficar desatualizado quando o papel do
 * usuário mudar, nada para um script da página conseguir ler.
 *
 * A aparência fica no `ShellPainel`, que é componente de cliente porque precisa
 * saber a rota atual (para acender o item do menu) e guardar o estado da
 * gaveta. Este arquivo continua no servidor, que é onde a sessão pode ser lida
 * com segurança.
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  let usuario: UsuarioAutenticado;

  try {
    usuario = await apiComSessao<UsuarioAutenticado>('/auth/eu');
  } catch (erro) {
    // `unstable_rethrow` deixa passar os erros que o próprio Next usa para
    // controlar o fluxo — `redirect()` e `notFound()` são implementados como
    // exceções. Sem ele, este `catch` engoliria o redirecionamento para
    // `/sair` que o cliente da API dispara quando a sessão é recusada, e a
    // pessoa veria "servidor indisponível" no lugar da tela de entrada.
    unstable_rethrow(erro);

    // Sobrou o que é falha de verdade: API fora do ar, rede caída, erro 500.
    //
    // Antes daqui existir, a exceção subia sem tratamento e o painel virava uma
    // página de erro do Next — sem menu, sem "sair" e sem caminho de volta,
    // porque `/entrar` devolve para `/painel` enquanto o cookie de sessão
    // existir. Em desenvolvimento isso acontecia a cada reinício da API.
    return <PainelIndisponivel />;
  }

  return (
    // O provedor de avisos entra aqui, e não na raiz da aplicação: as telas
    // públicas (site, entrar, cadastro) não disparam nenhum aviso, e envolver o
    // `<body>` inteiro obrigaria toda visita anônima a baixar e hidratar este
    // componente de cliente à toa.
    <ProvedorDeAvisos>
      <ShellPainel usuario={usuario} aoSair={sair}>
        {children}
      </ShellPainel>
    </ProvedorDeAvisos>
  );
}

/**
 * Tela de servidor inacessível.
 *
 * Oferece as duas únicas saídas que fazem sentido: tentar de novo (a falha
 * costuma ser passageira) e sair (que limpa a sessão e libera a tela de
 * entrada). O link de recarregar é um `<a>` comum, e não um `<Link>`: navegação
 * do lado do cliente reaproveitaria a árvore com erro em vez de pedir a página
 * inteira ao servidor de novo.
 */
function PainelIndisponivel() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="bg-destrutivo-suave text-destructive flex size-12 items-center justify-center rounded-full">
        <ServerCrash aria-hidden className="size-6" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Não conseguimos falar com o servidor
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Seus dados estão a salvo — apenas esta tela não conseguiu carregar. Costuma ser
          passageiro: tente de novo em alguns segundos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="/painel" className={estilosBotao()}>
          Tentar de novo
        </a>

        <Link href="/sair" className={estilosBotao({ variante: 'secundario' })}>
          Sair
        </Link>
      </div>
    </main>
  );
}
