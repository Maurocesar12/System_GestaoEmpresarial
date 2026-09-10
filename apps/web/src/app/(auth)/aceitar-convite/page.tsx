import type { Metadata } from 'next';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { FormularioAceitarConvite } from './formulario';

export const metadata: Metadata = {
  title: 'Aceitar convite',
  robots: { index: false, follow: false },
};

export default function PaginaAceitarConvite() {
  return (
    <Cartao className="w-full max-w-md">
      <CartaoCabecalho>
        <div>
          <CartaoTitulo>Entre para a equipe</CartaoTitulo>
          <p className="text-muted-foreground mt-1 text-sm">
            Confirme seu nome e crie uma senha para acessar a empresa.
          </p>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo>
        <FormularioAceitarConvite />
      </CartaoConteudo>
    </Cartao>
  );
}
