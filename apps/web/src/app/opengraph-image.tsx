import { ImageResponse } from 'next/og';
import { SITE } from '@/configuracao/site';

export const alt = `${SITE.nome} — ${SITE.descricao}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Imagem gerada pelo Next para compartilhamentos em WhatsApp e redes sociais. */
export default function ImagemCompartilhamento() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: SITE.corFundo,
        color: '#111111',
        padding: '76px 84px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 8,
            padding: '18px 16px',
            borderRadius: 20,
            background: SITE.corMarca,
          }}
        >
          <svg width="50" height="50" viewBox="0 0 32 32" fill="none">
            <path
              d="M8.5 22.5h15"
              stroke={SITE.corFundo}
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity=".42"
            />
            <path
              d="M9.25 21v-4.25m6.75 4.25v-7.5M22.75 21V10.75"
              stroke={SITE.corFundo}
              strokeWidth="2.45"
              strokeLinecap="round"
            />
            <path
              d="M9.25 16.75 16 13.5l3.6 2.05 3.15-4.8"
              stroke="#f5f5f5"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700 }}>{SITE.nome}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 960 }}>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.08 }}>
          O que você vendeu e o que entrou no caixa, no mesmo sistema.
        </div>
        <div style={{ display: 'flex', color: '#606060', fontSize: 29, lineHeight: 1.35 }}>
          {SITE.descricao}
        </div>
      </div>
    </div>,
    size,
  );
}
