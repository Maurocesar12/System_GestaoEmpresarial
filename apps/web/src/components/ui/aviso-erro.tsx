/**
 * Bloco de erro dos formulários.
 *
 * Mostra a mensagem principal e, quando existirem, os detalhes técnicos —
 * úteis durante o desenvolvimento para entender o que falhou sem precisar
 * abrir o console do navegador.
 *
 * Em produção os detalhes ficam escondidos: a API não devolve informação
 * interna em erro de servidor (o filtro de exceções cuida disso), e o que
 * chegaria aqui só confundiria quem está tentando entrar no sistema.
 */
export function AvisoErro({
  mensagem,
  detalhes,
}: {
  mensagem: string;
  detalhes?: Record<string, string[]>;
}) {
  const mostrarDetalhes = process.env.NODE_ENV !== 'production' && detalhes;

  const linhas = mostrarDetalhes
    ? Object.entries(detalhes).flatMap(([campo, mensagens]) =>
        mensagens.map((texto) => (campo === '_' ? texto : `${campo}: ${texto}`)),
      )
    : [];

  return (
    // `role="alert"` faz o leitor de tela anunciar a mensagem assim que ela
    // aparece, sem depender de o usuário navegar até ela.
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-destructive flex flex-col gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <p>{mensagem}</p>

      {linhas.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer opacity-80">Detalhes técnicos</summary>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono opacity-80">
            {linhas.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
