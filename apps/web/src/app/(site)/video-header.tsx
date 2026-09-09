import { CalendarDays, ChartNoAxesCombined, UsersRound } from 'lucide-react';
import styles from './hero.module.css';

/** Reprodução nativa: sem controles, estado React ou scripts de animação. */
export function VideoHeader() {
  return (
    <figure className={styles['hero-preview']}>
      <div className={styles['hero-video-crop']}>
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/header/header-gestao-poster.jpg"
          width={1920}
          height={1080}
          aria-hidden="true"
          className={styles['hero-video']}
        >
          <source src="/media/header/header-gestao-fullhd-hq.mp4" type="video/mp4" />
        </video>
      </div>
      <div className={styles['hero-float-clientes']} aria-hidden="true">
        <UsersRound />
        <span><strong>128</strong> clientes ativos</span>
      </div>
      <div className={styles['hero-float-agenda']} aria-hidden="true">
        <CalendarDays />
        <span><strong>Agenda</strong> organizada</span>
      </div>
      <div className={styles['hero-objects-3d']} aria-hidden="true">
        <span />
        <span />
        <span><ChartNoAxesCombined /></span>
      </div>
      <figcaption className={styles['hero-video-caption']}>
        <span>
          Uma visão do seu dia a dia <span className="hidden sm:inline">· Dados ilustrativos</span>
        </span>
      </figcaption>
    </figure>
  );
}
