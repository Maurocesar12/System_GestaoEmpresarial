import type { Metadata } from 'next';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { FormularioAceitarConvite } from './formulario';

export const metadata: Metadata = { title: 'Aceitar convite' };

export default async function PaginaAceitarConvite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
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
        {token ? <FormularioAceitarConvite token={token} /> : <AvisoConviteInvalido />}
      </CartaoConteudo>
    </Cartao>
  );
}

function AvisoConviteInvalido() {
  return (
    <p className="text-destructive text-sm">
      O link do convite está incompleto. Peça ao administrador para enviar um novo convite.
    </p>
  );
}
