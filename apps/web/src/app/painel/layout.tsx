import type { UsuarioAutenticado } from '@gestao/shared-types';
import { ShellPainel } from '@/components/painel/shell-painel';
import { apiComSessao } from '@/lib/api-servidor';
import { sair } from '../(auth)/acoes';

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
  const usuario = await apiComSessao<UsuarioAutenticado>('/auth/eu');

  return (
    <ShellPainel usuario={usuario} aoSair={sair}>
      {children}
    </ShellPainel>
  );
}
