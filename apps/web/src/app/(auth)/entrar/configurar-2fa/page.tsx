import type { Metadata } from 'next';
import { ConfigurarDoisFatores } from './configurar-dois-fatores';

export const metadata: Metadata = {
  title: 'Proteja sua conta',
};

/**
 * Primeiro acesso: configurar o app autenticador.
 *
 * Esta página não confere o cookie do desafio, ao contrário da verificação. Ao
 * ativar, a ação grava a sessão e apaga o desafio, e o Next renderiza a página
 * de novo no servidor. Um `redirect` aqui tiraria a pessoa da tela antes de ela
 * ver os códigos de recuperação, que a API entrega uma única vez. Quem chega
 * sem desafio recebe o aviso do próprio componente.
 */
export default function PaginaConfigurarDoisFatores() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Proteja sua conta</h1>
        <p className="text-muted-foreground text-sm">
          Além da senha, o acesso pede um código do seu celular. Assim, uma senha vazada sozinha não
          abre a conta.
        </p>
      </header>

      <ConfigurarDoisFatores />
    </div>
  );
}
