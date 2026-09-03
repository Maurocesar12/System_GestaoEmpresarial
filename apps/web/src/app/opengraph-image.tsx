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
        color: '#211d1a',
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
          {[22, 34, 46].map((altura) => (
            <div
              key={altura}
              style={{
                width: 8,
                height: altura,
                borderRadius: 8,
                background: SITE.corFundoEscuro,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700 }}>{SITE.nome}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 960 }}>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.08 }}>
          O que você vendeu e o que entrou no caixa, no mesmo sistema.
        </div>
        <div style={{ display: 'flex', color: '#6c625c', fontSize: 29, lineHeight: 1.35 }}>
          {SITE.descricao}
        </div>
      </div>
    </div>,
    size,
  );
}
