import styles from './hero.module.css';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  UsersRound,
} from 'lucide-react';
import { VideoHeader } from './video-header';

const ATALHOS = [
  {
    icone: UsersRound,
    titulo: 'Clientes e orçamentos',
    descricao: 'Nenhuma negociação escapa.',
    href: '#recursos',
  },
  {
    icone: CalendarDays,
    titulo: 'Uma rotina conectada',
    descricao: 'Venda virou agenda sozinha.',
    href: '#como-funciona',
  },
  {
    icone: ChartNoAxesCombined,
    titulo: 'Clareza sobre o caixa',
    descricao: 'O próximo mês, sem adivinhar.',
    href: '#ia',
  },
];

/** Assurances que abaixam a barreira de clicar: prazo, custo, saída. */
const GARANTIAS_HERO = ['14 dias grátis', 'Sem cartão de crédito', 'Cancele quando quiser'];

export function Hero() {
  return (
    <section className={styles['hero-site']} aria-labelledby="titulo-hero">
      <VideoHeader />

      <div className={styles['hero-container']}>
        <div className={styles['hero-main']}>
          <div className={styles['hero-copy']}>
            <p className={styles['hero-eyebrow']}>
              <span aria-hidden /> CHEGA DE PLANILHA. CHEGA DE ACHISMO.
            </p>
            <h1 id="titulo-hero">
              Você sabe quanto lucrou.
              <br />
              <span>Sem esperar o fim do mês.</span>
            </h1>
            <p className={styles['hero-description']}>
              Orçamento, agenda e financeiro na mesma linha. Você não fecha planilha: o sistema já
              sabe quanto cada serviço deixou de lucro.
            </p>
            <div className={styles['hero-actions']}>
              <Link href="/cadastro" className={styles['hero-primary']}>
                Testar grátis por 14 dias <ArrowRight aria-hidden />
              </Link>
              <a href="#como-funciona" className={styles['hero-secondary']}>
                <ArrowDown aria-hidden /> Ver como funciona
              </a>
            </div>
            <ul className={styles['hero-assurances']}>
              {GARANTIAS_HERO.map((item) => (
                <li key={item}>
                  <Check aria-hidden /> {item}
                </li>
              ))}
            </ul>
            <a href="#planos" className={styles['hero-plans']}>
              Ver preço e planos <ArrowRight aria-hidden />
            </a>
          </div>
        </div>
        <div className={styles['hero-bottom']}>
          <p className={styles['hero-bottom-label']}>
            DO PRIMEIRO CONTATO
            <br />
            <span>AO RESULTADO DO MÊS.</span>
          </p>
          <nav className={styles['hero-shortcuts']} aria-label="Explore o sistema">
            {ATALHOS.map(({ icone: Icone, titulo, descricao, href }) => (
              <a key={href} href={href} className={styles['hero-shortcut']}>
                <Icone aria-hidden className={styles['hero-shortcut-icon']} />
                <span>
                  <strong>{titulo}</strong>
                  <span>{descricao}</span>
                </span>
                <ArrowDown aria-hidden className={styles['hero-shortcut-arrow']} />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
