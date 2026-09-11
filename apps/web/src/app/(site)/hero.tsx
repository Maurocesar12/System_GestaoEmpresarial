import styles from './hero.module.css';
import Link from 'next/link';
import { ArrowDown, ArrowRight, CalendarDays, ChartNoAxesCombined, UsersRound } from 'lucide-react';
import { VideoHeader } from './video-header';

const ATALHOS = [
  {
    icone: UsersRound,
    titulo: 'Clientes e orçamentos',
    descricao: 'Cada oportunidade no lugar certo.',
    href: '#recursos',
  },
  {
    icone: CalendarDays,
    titulo: 'Uma rotina conectada',
    descricao: 'Do serviço vendido à agenda.',
    href: '#como-funciona',
  },
  {
    icone: ChartNoAxesCombined,
    titulo: 'Clareza sobre o caixa',
    descricao: 'Veja os próximos meses com IA.',
    href: '#ia',
  },
];

export function Hero() {
  return (
    <section className={styles['hero-site']} aria-labelledby="titulo-hero">
      <VideoHeader />

      <div className={styles['hero-container']}>
        <div className={styles['hero-main']}>
          <div className={styles['hero-copy']}>
            <p className={styles['hero-eyebrow']}>
              <span aria-hidden /> MENOS PLANILHAS. MAIS CLAREZA.
            </p>
            <h1 id="titulo-hero">
              Seu negócio organizado.
              <br />
              <span>Seu lucro à vista.</span>
            </h1>
            <p className={styles['hero-description']}>
              Clientes, orçamentos e agenda conectados ao financeiro. Saiba o que precisa da sua
              atenção e quanto cada serviço deixa de lucro.
            </p>
            <div className={styles['hero-actions']}>
              <Link href="/cadastro" className={styles['hero-primary']}>
                Criar minha conta <ArrowRight aria-hidden />
              </Link>
              <a href="#como-funciona" className={styles['hero-secondary']}>
                <ArrowDown aria-hidden /> Ver como funciona
              </a>
            </div>
            <a href="#planos" className={styles['hero-plans']}>
              Conheça os planos <ArrowRight aria-hidden />
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
