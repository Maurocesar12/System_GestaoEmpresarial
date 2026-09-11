import { BellRing, CalendarDays, CircleCheckBig, KanbanSquare, Wallet } from 'lucide-react';
import styles from './grafico-3d.module.css';

/**
 * As telas do sistema, empilhadas em profundidade.
 *
 * ## Por que estas três, nesta ordem
 *
 * É o caminho que o produto promete, do fundo para a frente: a negociação
 * avança no funil, vira compromisso na agenda e termina como dinheiro no
 * financeiro — com a margem já calculada. Empilhadas no mesmo eixo, elas
 * mostram um sistema só; lado a lado, mostrariam três programas.
 *
 * Os dados são de exemplo, mas as palavras são as do sistema de verdade:
 * etapas do funil, serviço na agenda, entrada e saída no lançamento. Quem já
 * usa reconhece; quem não usa entende o que vai encontrar.
 *
 * Componente de servidor: sem estado, sem evento, **sem um byte de JavaScript**
 * no navegador. A profundidade e o movimento estão em `grafico-3d.module.css`.
 */
export function Grafico3D() {
  return (
    <div className={styles.cena}>
      <span className={styles.piso} aria-hidden />
      <span className={styles.fluxo} aria-hidden />

      <div className={styles.pilha} aria-hidden>
        <article className={`${styles.tela} ${styles.telaFunil}`}>
          <header className={styles.telaCabecalho}>
            <KanbanSquare /> Funil
          </header>

          <div className={styles.telaCorpo}>
            {[
              { etapa: 'Novo contato', cartoes: 2, destaque: false },
              { etapa: 'Orçamento', cartoes: 2, destaque: false },
              { etapa: 'Fechado', cartoes: 1, destaque: true },
            ].map((coluna) => (
              <div key={coluna.etapa} className={styles.colunaFunil}>
                <span className={styles.tituloColuna}>{coluna.etapa}</span>
                {Array.from({ length: coluna.cartoes }, (_, indice) => (
                  <span
                    key={indice}
                    className={`${styles.cartaoFunil} ${
                      coluna.destaque ? styles.cartaoDestaque : ''
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </article>

        <article className={`${styles.tela} ${styles.telaAgenda}`}>
          <header className={styles.telaCabecalho}>
            <CalendarDays /> Agenda
          </header>

          <div className={styles.telaCorpo} style={{ flexDirection: 'column', gap: 0 }}>
            {[
              { hora: '09:00', servico: 'Revisão completa', selo: 'Confirmado' },
              { hora: '11:30', servico: 'Troca de óleo', selo: 'Agendado' },
              { hora: '15:00', servico: 'Orçamento no local', selo: 'Agendado' },
            ].map((item) => (
              <div key={item.hora} className={styles.linhaAgenda}>
                <span className={styles.hora}>{item.hora}</span>
                {item.servico}
                <span className={styles.pilula}>{item.selo}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={`${styles.tela} ${styles.telaFinanceiro}`}>
          <header className={styles.telaCabecalho}>
            <Wallet /> Financeiro
          </header>

          <div className={styles.telaCorpo} style={{ flexDirection: 'column', gap: 0 }}>
            <div className={styles.linhaValor}>
              Revisão completa
              <span className={styles.valorEntrada}>+ R$ 1.240</span>
            </div>
            <div className={styles.linhaValor}>
              Peças e material
              <span className={styles.valorSaida}>− R$ 380</span>
            </div>
            <div className={styles.linhaValor}>
              Troca de óleo
              <span className={styles.valorEntrada}>+ R$ 320</span>
            </div>

            <div className={styles.rodapeMargem}>
              Margem
              <span className={styles.barraMargem} />
              <span className={styles.percentual}>32%</span>
            </div>
          </div>
        </article>
      </div>

      <span className={`${styles.chip} ${styles.chipAprovado}`} aria-hidden>
        <CircleCheckBig />
        <span className={styles.chipTexto}>
          <span className={styles.chipTitulo}>Orçamento aprovado</span>
          <span className={styles.chipValor}>virou agenda</span>
        </span>
      </span>

      <span className={`${styles.chip} ${styles.chipLembrete}`} aria-hidden>
        <BellRing />
        <span className={styles.chipTexto}>
          <span className={styles.chipTitulo}>Lembrete</span>
          <span className={styles.chipValor}>retorno em 30 dias</span>
        </span>
      </span>

      <p className="sr-only">
        As telas do sistema em camadas: o funil com a negociação fechada, a agenda com os serviços
        do dia e o financeiro com as entradas, as saídas e a margem de 32% já calculada.
      </p>
    </div>
  );
}
