import styles from './grafico-3d.module.css';

/**
 * As três colunas que resumem o produto: o que entrou, o que custou, o que
 * sobrou. Números ilustrativos, escolhidos para representar um mês comum de
 * uma empresa de serviço — e identificados como exemplo na legenda.
 */
const COLUNAS = [
  { rotulo: 'Recebido', valor: 'R$ 42.800', proporcao: 1, tom: 'var(--grafico-2)' },
  { rotulo: 'Custos', valor: 'R$ 29.100', proporcao: 0.68, tom: 'var(--grafico-3)' },
  { rotulo: 'Sobrou', valor: 'R$ 13.700', proporcao: 0.32, tom: 'var(--sucesso)' },
] as const;

/**
 * Gráfico tridimensional do resultado do mês.
 *
 * Componente de servidor: não tem estado, não tem evento e não manda um byte
 * de JavaScript para o navegador. Toda a tridimensionalidade e a animação de
 * entrada vivem no CSS — o detalhe do porquê está em `grafico-3d.module.css`.
 */
export function Grafico3D() {
  return (
    <figure className={styles.cena}>
      <div className={styles.chao} aria-hidden />

      <div className={styles.palco}>
        {COLUNAS.map((coluna) => (
          <div key={coluna.rotulo} className={styles.coluna}>
            <span className={styles.valor}>{coluna.valor}</span>

            <div
              className={styles.barra}
              style={
                {
                  '--proporcao': coluna.proporcao,
                  '--tom': coluna.tom,
                } as React.CSSProperties
              }
              aria-hidden
            >
              <span className={styles.face} />
              <span className={styles.lateral} />
              <span className={styles.topo} />
            </div>

            <span className={styles.rotulo}>{coluna.rotulo}</span>
          </div>
        ))}
      </div>

      <figcaption className="sr-only">
        Exemplo de um mês: R$ 42.800 recebidos, R$ 29.100 de custos e R$ 13.700 de sobra.
      </figcaption>
    </figure>
  );
}
