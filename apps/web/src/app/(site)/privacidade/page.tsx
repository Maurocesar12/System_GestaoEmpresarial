import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DIAS_PARA_EXCLUIR_CONTA_CANCELADA, DIAS_VALIDADE_SESSAO } from '@gestao/shared-types';
import { SITE } from '@/configuracao/site';

export const metadata: Metadata = {
  title: 'Política de Privacidade e Retenção de Dados',
  description: `Como o ${SITE.nome} trata, protege e exclui dados pessoais.`,
};

const ATUALIZADA_EM = '15 de setembro de 2026';

/**
 * Política pública de privacidade e retenção.
 *
 * Os prazos vêm de `@gestao/shared-types`, os mesmos números que a API usa para
 * apagar: se um mudar, a página muda junto e não promete o que o sistema não faz.
 */
export default function PaginaPrivacidade() {
  const retencao: Array<{ dado: string; prazo: ReactNode }> = [
    {
      dado: 'Cadastro da empresa, equipe, clientes, CRM e financeiro',
      prazo: 'Enquanto a conta estiver ativa.',
    },
    {
      dado: 'Cliente anonimizado a pedido do titular',
      prazo:
        'Nome, e-mail, telefone, documento, observações e anotações são eliminados na hora. ' +
        'Valores e datas de orçamentos e lançamentos continuam, sem identificar a pessoa.',
    },
    {
      dado: 'Conta cancelada',
      prazo: `O acesso é encerrado no cancelamento. Todos os dados são excluídos definitivamente ${DIAS_PARA_EXCLUIR_CONTA_CANCELADA} dias depois.`,
    },
    {
      dado: 'Comprovante de exclusão de conta',
      prazo:
        'Guardado por tempo indeterminado, apenas com o identificador interno da conta e as datas de cancelamento e exclusão. Não contém dados pessoais.',
    },
    {
      dado: 'Histórico de auditoria (quem alterou o quê)',
      prazo:
        'Enquanto a conta existir. O administrador pode excluí-lo a qualquer momento, e ele é limpo junto quando um cliente é anonimizado.',
    },
    {
      dado: 'Sessões de acesso',
      prazo: `Expiram em ${DIAS_VALIDADE_SESSAO} dias sem uso e são revogadas ao sair ou cancelar a conta. Guardamos apenas um hash do token.`,
    },
    {
      dado: 'Cópias de segurança do banco de dados',
      prazo:
        'Mantidas pelo provedor de banco de dados pelo período de retenção do plano contratado e sobrescritas automaticamente depois disso.',
    },
  ];

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Política de Privacidade e Retenção de Dados
        </h1>
        <p className="text-muted-foreground text-sm">Última atualização: {ATUALIZADA_EM}.</p>
        <p className="leading-relaxed">
          Esta política explica como o {SITE.nome} trata dados pessoais, por quanto tempo os guarda
          e como exercer os direitos previstos na Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>
      </header>

      <Secao titulo="1. Quem é responsável por cada dado">
        <p>
          Para os dados de cadastro da empresa assinante e dos usuários da equipe, o {SITE.nome} é o{' '}
          <strong>controlador</strong>.
        </p>
        <p>
          Para os dados dos clientes que cada empresa cadastra no sistema, a empresa assinante é a{' '}
          <strong>controladora</strong> e o {SITE.nome} atua como <strong>operador</strong>:
          tratamos esses dados apenas para prestar o serviço e seguindo as instruções da empresa. Se
          você é cliente de uma empresa que usa o sistema, faça seus pedidos diretamente a ela.
        </p>
      </Secao>

      <Secao titulo="2. Dados que tratamos">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Conta:</strong> nome da empresa, CNPJ, e-mail e telefone de contato; nome,
            e-mail e papel de cada usuário. A senha é guardada somente como hash Argon2id.
          </li>
          <li>
            <strong>Dados inseridos pela empresa:</strong> clientes (nome, contato, documento,
            origem e campos personalizados), atendimentos, orçamentos, agendamentos, lembretes e
            lançamentos financeiros.
          </li>
          <li>
            <strong>Uso:</strong> data do último acesso e histórico de alterações feitas pela
            equipe.
          </li>
        </ul>
        <p>
          Usamos apenas cookies essenciais de sessão, que mantêm você conectado. Não usamos cookies
          de publicidade.
        </p>
      </Secao>

      <Secao titulo="3. Finalidades e bases legais">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Prestar o serviço contratado e manter a conta funcionando: execução de contrato (art.
            7º, V).
          </li>
          <li>
            Enviar e-mails transacionais, como convites, recuperação de senha e lembretes
            configurados pela empresa: execução de contrato.
          </li>
          <li>
            Registrar alterações para segurança e prevenção a fraudes: legítimo interesse (art. 7º,
            IX).
          </li>
          <li>Cumprir obrigações legais e fiscais: obrigação legal (art. 7º, II).</li>
        </ul>
      </Secao>

      <Secao titulo="4. Com quem compartilhamos">
        <p>Não vendemos dados. Compartilhamos somente com fornecedores necessários ao serviço:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Hospedagem da aplicação e do banco de dados.</li>
          <li>Envio de e-mails transacionais.</li>
          <li>
            Inteligência artificial, no plano Premium. A previsão financeira envia apenas totais
            agregados. O assistente com IA envia as informações do painel necessárias para
            responder, que podem incluir nomes de clientes.
          </li>
        </ul>
        <p>
          Esses fornecedores podem processar dados fora do Brasil, com as salvaguardas previstas no
          art. 33 da LGPD.
        </p>
      </Secao>

      <Secao titulo="5. Por quanto tempo guardamos" id="retencao">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-superficie">
              <tr>
                <th scope="col" className="w-2/5 px-4 py-3 font-medium">
                  Dado
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Prazo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {retencao.map((linha) => (
                <tr key={linha.dado} className="align-top">
                  <td className="px-4 py-3 font-medium">{linha.dado}</td>
                  <td className="text-muted-foreground px-4 py-3">{linha.prazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="6. Seus direitos e como exercê-los">
        <p>
          A LGPD garante acesso, correção, portabilidade, anonimização, eliminação e informação
          sobre compartilhamento (art. 18). No sistema:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Clientes de uma empresa assinante:</strong> a empresa baixa uma cópia dos seus
            dados e os anonimiza pela ficha do cliente, em &ldquo;Dados pessoais (LGPD)&rdquo;.
          </li>
          <li>
            <strong>Empresa assinante:</strong> o administrador exporta todos os dados e cancela a
            conta em &ldquo;Privacidade e dados&rdquo;, no painel.
          </li>
          <li>
            <strong>Usuários da equipe:</strong> o administrador da empresa corrige ou desativa o
            acesso em &ldquo;Equipe&rdquo;.
          </li>
        </ul>
      </Secao>

      <Secao titulo="7. Segurança">
        <p>
          Os dados de cada empresa ficam isolados no banco por Row-Level Security, as conexões usam
          HTTPS, as senhas são guardadas com Argon2id e as sessões são curtas e renovadas com
          rotação de token.
        </p>
      </Secao>

      <Secao titulo="8. Encarregado de dados">
        {SITE.emailPrivacidade ? (
          <p>
            Dúvidas e pedidos sobre privacidade:{' '}
            <a
              href={`mailto:${SITE.emailPrivacidade}`}
              className="font-medium underline underline-offset-4"
            >
              {SITE.emailPrivacidade}
            </a>
            .
          </p>
        ) : (
          <p>
            Dúvidas e pedidos sobre privacidade podem ser enviados pelos canais de atendimento
            informados na contratação.
          </p>
        )}
        <p>
          Se não ficar satisfeito com a resposta, você pode reclamar à Autoridade Nacional de
          Proteção de Dados (ANPD).
        </p>
      </Secao>

      <footer className="text-muted-foreground border-t pt-6 text-sm">
        <Link href="/" className="underline underline-offset-4">
          Voltar para a página inicial
        </Link>
      </footer>
    </article>
  );
}

function Secao({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3 leading-relaxed">
      <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
      {children}
    </section>
  );
}
