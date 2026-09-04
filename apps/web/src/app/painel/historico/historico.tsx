import type { LucideIcon } from 'lucide-react';
import { possuiPermissao, type Permissao, type UsuarioAutenticado } from '@gestao/shared-types';

export interface ItemHistorico {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** `null` significa visível para qualquer usuário autenticado. */
  permissao: Permissao | null;
  movimentacao: string;
}

export function filtrarHistoricoPorPermissao(
  historico: readonly ItemHistorico[],
  usuario: UsuarioAutenticado,
  movimentacao: string
): readonly ItemHistorico[] {
  return historico.filter((item) => {
    if (item.permissao && !possuiPermissao(usuario, item.permissao)) {
      return false;
    }
    return item.movimentacao === movimentacao;
  });
}

export default async function Historico({
  historico,
  usuario,
  movimentacao
}: {
  historico: readonly ItemHistorico[];
  usuario: UsuarioAutenticado;
  movimentacao: string;
}) {
  const historicoFiltrado = filtrarHistoricoPorPermissao(historico, usuario, movimentacao);

  return (
    <div className="flex flex-col gap-6">
      {historicoFiltrado.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <item.icone className="h-6 w-6" />
          <div className="flex flex-col">
            <span className="font-medium">{item.rotulo}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{item.movimentacao}</span>
          </div>
        </a>
      ))}
    </div>  
  );
}           