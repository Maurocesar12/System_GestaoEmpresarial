import { GLOSSARIO, type Conceito, type IdConceito } from '@/lib/glossario';
import { BalaoConceito, type PassoDeConta } from './balao-conceito';

export type { PassoDeConta };

interface Props {
  conceito: IdConceito;
  /**
   * A conta com os números da própria empresa, na ordem em que se lê. Os
   * valores vêm da API, já formatados — este componente não soma nada.
   */
  passos?: PassoDeConta[];
  className?: string;
}

/**
 * Explicação de um termo, ao lado do próprio termo.
 *
 * É a porta de entrada do glossário: o usuário que não sabe o que é "ticket
 * médio" clica no "?" e lê ali mesmo, sem trocar de tela nem abrir o chat.
 *
 * Existe em duas peças de propósito. Este wrapper roda no servidor e entrega ao
 * cliente **só o texto do conceito pedido**; se o balão importasse o glossário
 * direto, as trinta e tantas definições viajariam em todo o pacote de qualquer
 * tela que tivesse um "?".
 *
 * O `conceito` é tipado pelas chaves do glossário: escrever um nome que não
 * existe é erro de compilação, e não um balão vazio em produção.
 */
export function DicaConceito({ conceito, passos, className }: Props) {
  const dados: Conceito = GLOSSARIO[conceito];

  return (
    <BalaoConceito
      titulo={dados.titulo}
      resumo={dados.resumo}
      comoCalcula={dados.comoCalcula}
      comoLer={dados.comoLer}
      exemplo={dados.exemplo}
      passos={passos}
      hrefGlossario={`/painel/ajuda#${conceito}`}
      className={className}
    />
  );
}
