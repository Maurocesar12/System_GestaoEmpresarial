import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Filtro de lista que convive com outros filtros.
 *
 * O `FiltroLink` monta o endereço com **um** parâmetro e descarta o resto — o
 * que serve para telas de um filtro só. Nas telas de leads e reativação existem
 * dois ao mesmo tempo (situação e janela de dias), e trocar um deles não pode
 * apagar o outro: quem filtrou "aguardando" e então escolheu "90 dias" espera
 * continuar vendo os que aguardam.
 *
 * Continua sendo link, pelo mesmo motivo do original: o recorte fica na URL,
 * então volta pelo botão do navegador, sobrevive ao recarregar e pode ser
 * mandado para outra pessoa.
 */
export function FiltroComposto({
  base,
  parametros,
  parametro,
  valor,
  atual,
  rotulo,
}: {
  base: string;
  /** Os filtros aplicados agora. O que este link não muda, ele preserva. */
  parametros: Record<string, string | undefined>;
  parametro: string;
  /** `undefined` é a opção "todos", que remove este filtro. */
  valor?: string;
  atual?: string;
  rotulo: string;
}) {
  const ativo = (atual ?? undefined) === valor;
  const query = new URLSearchParams();

  for (const [chave, valorAtual] of Object.entries({ ...parametros, [parametro]: valor })) {
    if (valorAtual) query.set(chave, valorAtual);
  }

  const consulta = query.toString();

  return (
    <Link
      href={consulta ? `${base}?${consulta}` : base}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm transition-colors',
        ativo
          ? 'bg-primary text-primary-foreground border-primary font-medium'
          : 'bg-card hover:bg-accent text-muted-foreground hover:text-foreground',
      )}
    >
      {rotulo}
    </Link>
  );
}
