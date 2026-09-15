import type { Metadata } from 'next';
import Link from 'next/link';
import { DIAS_PARA_EXCLUIR_CONTA_CANCELADA, type UsuarioAutenticado } from '@gestao/shared-types';
import { estilosBotao } from '@/components/ui/botao';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { apiComSessao } from '@/lib/api-servidor';
import { lerUsuarioDaSessao } from '@/lib/sessao';
import { FormularioCancelarConta } from './formulario-cancelar-conta';

export const metadata: Metadata = { title: 'Privacidade e dados' };

export default async function PaginaPrivacidadeEDados() {
  const usuario =
    (await lerUsuarioDaSessao()) ?? (await apiComSessao<UsuarioAutenticado>('/auth/eu'));
  const administrador = usuario.papel === 'admin';

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Privacidade e dados"
        descricao="Cópia dos dados da empresa, pedidos de clientes (LGPD) e cancelamento da conta."
      />

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Pedidos de clientes</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="text-muted-foreground flex flex-col gap-2 text-sm">
          <p>
            Quando um cliente pedir os dados dele ou a exclusão, abra a ficha do cliente e use
            &ldquo;Dados pessoais (LGPD)&rdquo;. Lá dá para baixar tudo o que o sistema guarda sobre
            a pessoa e depois anonimizar o cadastro.
          </p>
          <p>
            <Link
              href="/privacidade"
              target="_blank"
              className="text-foreground underline underline-offset-4"
            >
              Política de privacidade e retenção
            </Link>
          </p>
        </CartaoConteudo>
      </Cartao>

      {!administrador ? (
        <p className="text-muted-foreground text-sm">
          Somente o administrador da empresa pode exportar todos os dados ou cancelar a conta.
        </p>
      ) : (
        <>
          <Cartao>
            <CartaoCabecalho>
              <CartaoTitulo>Cópia dos dados da empresa</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo className="flex flex-col items-start gap-3 text-sm">
              <p className="text-muted-foreground">
                Um arquivo JSON com clientes, CRM, financeiro, equipe e histórico. Senhas e o
                conteúdo dos anexos não entram no arquivo.
              </p>
              <a
                href="/painel/privacidade/exportar"
                download
                className={estilosBotao({ variante: 'secundario' })}
              >
                Baixar dados da empresa
              </a>
            </CartaoConteudo>
          </Cartao>

          <Cartao className="border-destructive/30">
            <CartaoCabecalho>
              <CartaoTitulo>Cancelar conta</CartaoTitulo>
            </CartaoCabecalho>
            <CartaoConteudo className="flex flex-col gap-4 text-sm">
              <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5">
                <li>O acesso de toda a equipe é encerrado na hora.</li>
                <li>Lembretes pendentes são cancelados e convites deixam de valer.</li>
                <li>
                  Todos os dados são excluídos definitivamente em{' '}
                  {DIAS_PARA_EXCLUIR_CONTA_CANCELADA} dias. Baixe a cópia antes.
                </li>
              </ul>
              <FormularioCancelarConta nomeEmpresa={usuario.nomeEmpresa} />
            </CartaoConteudo>
          </Cartao>
        </>
      )}
    </div>
  );
}
