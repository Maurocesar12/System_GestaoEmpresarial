import type { Metadata } from 'next';
import { ConfigurarDoisFatores } from './configurar-dois-fatores';

export const metadata: Metadata = {
  title: 'Ativar verificação em duas etapas',
};

/**
 * Primeiro acesso: configurar o app autenticador.
 *
 * Sem checagem do cookie do desafio aqui: quem chega sem ele recebe o aviso
 * do próprio componente, com o caminho de volta para o login.
 */
export default function PaginaConfigurarDoisFatores() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ative a verificação em duas etapas
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Leva cerca de 1 minuto e é feito uma vez só. Depois, sempre que entrar, além da senha você
          digita um código que aparece no seu celular.
        </p>
      </header>

      <ConfigurarDoisFatores />
    </div>
  );
}
