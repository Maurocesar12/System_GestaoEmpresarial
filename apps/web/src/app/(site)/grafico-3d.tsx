'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  CircleCheckBig,
  KanbanSquare,
  Pause,
  Play,
  Wallet,
} from 'lucide-react';
import styles from './grafico-3d.module.css';

const ETAPAS = [
  {
    nome: 'Orçamento',
    icone: KanbanSquare,
    titulo: 'Uma oportunidade vira serviço.',
    aviso: 'Orçamento aprovado',
    detalhe: 'Revisão completa · R$ 1.240',
  },
  {
    nome: 'Agenda',
    icone: CalendarDays,
    titulo: 'O próximo passo já tem horário.',
    aviso: 'Serviço agendado',
    detalhe: 'Revisão completa · hoje, às 09:00',
  },
  {
    nome: 'Financeiro',
    icone: Wallet,
    titulo: 'Você sabe quanto ficou no caixa.',
    aviso: 'Recebimento registrado',
    detalhe: 'Receita e custo ligados ao serviço',
  },
] as const;

/** Demonstração vetorial: texto nítido em qualquer densidade de tela. */
export function Grafico3D() {
  const [etapa, setEtapa] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const cena = useRef<HTMLDivElement>(null);
  const executando = !pausado && visivel;
  const atual = ETAPAS[etapa]!;

  useEffect(() => {
    const elemento = cena.current;
    if (!elemento) return;
    let naTela = false;
    const atualizar = () => setVisivel(!document.hidden && naTela);
    const observer = new IntersectionObserver(
      ([entrada]) => {
        naTela = entrada?.isIntersecting ?? false;
        atualizar();
      },
      { threshold: 0.15 },
    );
    observer.observe(elemento);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);

  useEffect(() => {
    if (!executando) return;
    const timer = window.setTimeout(
      () => setEtapa((anterior) => (anterior + 1) % ETAPAS.length),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [etapa, executando]);

  return (
    <div ref={cena} className={styles.cena} data-pausado={!executando}>
      <div className={styles.topo}>
        <span className={styles.status}>
          <span /> SISTEMA EM MOVIMENTO
        </span>
        <button
          type="button"
          className={styles.controle}
          onClick={() => setPausado((valor) => !valor)}
          aria-label={pausado ? 'Reproduzir demonstração' : 'Pausar demonstração'}
        >
          {pausado ? <Play aria-hidden /> : <Pause aria-hidden />}
        </button>
      </div>
      <div className={styles.etapas} role="group" aria-label="Etapas da demonstração">
        {ETAPAS.map((item, indice) => (
          <button
            type="button"
            key={item.nome}
            className={styles.etapa}
            aria-pressed={etapa === indice}
            onClick={() => {
              setEtapa(indice);
              setPausado(true);
            }}
          >
            <item.icone aria-hidden />
            <span>{item.nome}</span>
            {indice < 2 && <ArrowRight aria-hidden className={styles.seta} />}
          </button>
        ))}
      </div>
      <div className={styles.palco}>
        <div className={styles.tela} key={etapa}>
          <header className={styles.cabecalho}>
            <span>
              <atual.icone aria-hidden />
              {atual.nome}
            </span>
            <span className={styles.numero}>
              0{etapa + 1} <span>/ 03</span>
            </span>
          </header>
          <p className={styles.titulo}>{atual.titulo}</p>
          {etapa === 0 && (
            <div className={styles.funil}>
              <div className={styles.colunas}>
                <span>Em negociação</span>
                <ArrowRight aria-hidden />
                <span>
                  Aprovado <Check aria-hidden />
                </span>
              </div>
              <div className={styles.trilho}>
                <div className={styles.destino} />
                <div className={styles.orcamento}>
                  <span className={styles.metadado}>ORÇAMENTO #0142</span>
                  <strong>Revisão completa</strong>
                  <span>Cliente de exemplo</span>
                  <b>
                    R$ 1.240
                    <span className={styles.confirmacao}>
                      <CircleCheckBig aria-hidden />
                    </span>
                  </b>
                </div>
              </div>
              <div className={styles.legenda}>
                <CircleCheckBig aria-hidden /> Do orçamento ao próximo atendimento.
              </div>
            </div>
          )}
          {etapa === 1 && (
            <div className={styles.agenda}>
              <div className={styles.dia}>
                <CalendarDays aria-hidden />
                <strong>Hoje</strong>
                <span>3 atendimentos</span>
              </div>
              {[
                ['09:00', 'Revisão completa', 'Confirmado'],
                ['11:30', 'Troca de óleo', 'Agendado'],
                ['15:00', 'Avaliação no local', 'Agendado'],
              ].map(([hora, servico, selo], indice) => (
                <div
                  key={hora}
                  className={`${styles.compromisso} ${indice === 0 ? styles.novo : ''}`}
                  style={{ '--ordem': indice } as CSSProperties}
                >
                  <time>{hora}</time>
                  <span>{servico}</span>
                  <small>{selo}</small>
                </div>
              ))}
              <div className={styles.legenda}>
                <BellRing aria-hidden /> Lembrete de retorno em 30 dias.
              </div>
            </div>
          )}
          {etapa === 2 && (
            <div className={styles.financeiro}>
              <div className={styles.resumo}>
                <div>
                  <span>Resultado do serviço</span>
                  <strong>
                    R$ 860<span>,00</span>
                  </strong>
                  <small>Receita de R$ 1.240 − custo de R$ 380</small>
                </div>
                <span className={styles.iconeSaldo}>
                  <ArrowDownLeft aria-hidden />
                </span>
              </div>
              <div className={styles.balanco}>
                <div>
                  <span>Recebido</span>
                  <b>R$ 1.240</b>
                  <i style={{ '--largura': '100%', '--ordem': 0 } as CSSProperties} />
                </div>
                <div>
                  <span>Custo</span>
                  <b>R$ 380</b>
                  <i style={{ '--largura': '30.65%', '--ordem': 1 } as CSSProperties} />
                </div>
                <div>
                  <span>Resultado</span>
                  <b>R$ 860</b>
                  <i style={{ '--largura': '69.35%', '--ordem': 2 } as CSSProperties} />
                </div>
              </div>
              <div className={styles.margem}>
                <span>Margem do serviço</span>
                <strong>69,4%</strong>
                <CircleCheckBig aria-hidden />
              </div>
            </div>
          )}
        </div>
        <div key={`aviso-${etapa}`} className={styles.aviso}>
          <span className={styles.iconeAviso}>
            <CircleCheckBig aria-hidden />
          </span>
          <div>
            <strong>{atual.aviso}</strong>
            <span>{atual.detalhe}</span>
          </div>
          <span className={styles.agora}>agora</span>
        </div>
      </div>
      <div className={styles.progresso} aria-hidden key={`progresso-${etapa}-${executando}`}>
        <span />
      </div>
    </div>
  );
}
