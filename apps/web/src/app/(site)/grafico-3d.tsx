import styles from './grafico-3d.module.css';

/**
 * As três colunas que resumem o mês: o que entrou, o que custou, o que sobrou.
 * Números ilustrativos, escolhidos para representar um mês comum de uma
 * empresa de serviço — e identificados como exemplo na legenda da seção.
 */
const COLUNAS = [
  { rotulo: 'Recebido', valor: 'R$ 42.800', proporcao: 1, tom: 'var(--grafico-2)' },
  { rotulo: 'Custos', valor: 'R$ 29.100', proporcao: 0.68, tom: 'var(--grafico-3)' },
  { rotulo: 'Sobrou', valor: 'R$ 13.700', proporcao: 0.32, tom: 'var(--sucesso)' },
] as const;

/**
 * Cena tridimensional do resultado do mês.
 *
 * Componente de servidor: sem estado, sem evento, **sem um byte de JavaScript**
 * no navegador. Toda a profundidade, o piso em fuga e as peças que escapam do
 * quadro vivem no CSS — o porquê de cada escolha está em `grafico-3d.module.css`.
 */
export function Grafico3D() {
  return (
    <div className={styles.cena}>
      <span className={styles.piso} aria-hidden />
      <span className={styles.brilho} aria-hidden />

      {/*
        As peças soltas ficam fora do palco de propósito: elas não giram junto
        com as barras, e é esse descolamento que faz a cena parecer ter
        profundidade real em vez de ser um desenho inclinado.
      */}
      <span className={`${styles.cubo} ${styles.cuboAlto}`} aria-hidden>
        <span />
        <span />
        <span />
      </span>

      <span className={`${styles.cubo} ${styles.cuboBaixo}`} aria-hidden>
        <span />
        <span />
        <span />
      </span>

      <span className={`${styles.chip} ${styles.chipMargem}`} aria-hidden>
        <span className={styles.chipTitulo}>Margem</span>
        <span className={styles.chipValor}>32%</span>
      </span>

      <span className={`${styles.chip} ${styles.chipCaixa}`} aria-hidden>
        <span className={styles.chipTitulo}>Em caixa</span>
        <span className={styles.chipValor}>R$ 13.700</span>
      </span>

      <div className={styles.palco}>
        {COLUNAS.map((coluna, indice) => (
          <div key={coluna.rotulo} className={styles.coluna}>
            <span className={styles.valor}>{coluna.valor}</span>

            <div
              className={styles.barra}
              style={
                {
                  '--proporcao': coluna.proporcao,
                  '--tom': coluna.tom,
                  // Escalonado: as três subindo juntas parecem um bloco só.
                  '--atraso': `${indice * 130}ms`,
                } as React.CSSProperties
              }
              aria-hidden
            >
              <span className={styles.face} />
              <span className={styles.lado} />
              <span className={styles.topo} />
            </div>

            <span className={styles.rotulo}>{coluna.rotulo}</span>
          </div>
        ))}
      </div>

      <p className="sr-only">
        Exemplo de um mês: R$ 42.800 recebidos, R$ 29.100 de custos e R$ 13.700 de sobra, uma margem
        de 32%.
      </p>
    </div>
  );
}
