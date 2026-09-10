import type { Metadata } from 'next';
import { FormularioRecuperacao } from './formulario';

export const metadata: Metadata = { title: 'Recuperar senha', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function RecuperarSenha() {
  return <FormularioRecuperacao />;
}
