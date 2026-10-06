'use client';

import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { Esqueleto } from '@/components/ui/esqueleto';
import { ativarDoisFatores, prepararConfiguracao, type ResultadoConfiguracao } from '../../acoes';
import { CampoCodigo } from '../campo-codigo';

type Configuracao = NonNullable<ResultadoConfiguracao['configuracao']>;

/**
 * Configuração do app autenticador em três passos, cada um com a ação exata.
 *
 * O texto diz onde tocar ("+", "Ler código QR") porque quem nunca usou um app
 * autenticador não sabe o que "escaneie o QR" significa na prática.
 *
 * O QR é pedido ao montar, e uma vez só: a cada pedido a API gera um segredo
 * novo, e o React em modo estrito monta o componente duas vezes em
 * desenvolvimento. Dois segredos seguidos deixariam o QR na tela diferente do
 * que a API espera.
 */
export function ConfigurarDoisFatores() {
  const pedido = useRef(false);
  const [configuracao, setConfiguracao] = useState<Configuracao>();
  const [falha, setFalha] = useState<string>();
  const [expirou, setExpirou] = useState(false);
  const [ativando, iniciar] = useTransition();

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;

    void prepararConfiguracao().then((resultado) => {
      if (resultado.configuracao) setConfiguracao(resultado.configuracao);
      else {
        setFalha(resultado.erro);
        setExpirou(true);
      }
    });
  }, []);

  if (expirou) {
    return (
      <div className="flex flex-col gap-4">
        <AvisoErro mensagem={falha ?? 'O tempo para ativar acabou.'} />
        <Link href="/entrar" className={estilosBotao()}>
          Entrar de novo
        </Link>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-6">
      <Passo numero={1} titulo="Instale um app autenticador no celular">
        <p>
          Na Play Store (Android) ou na App Store (iPhone), instale o{' '}
          <strong className="text-foreground">Google Authenticator</strong>. É gratuito. Se já tiver
          o Microsoft Authenticator ou o Authy, pode usar um deles.
        </p>
      </Passo>

      <Passo numero={2} titulo="Leia o QR code com o app">
        <p>
          No app, toque em <strong className="text-foreground">+</strong> e depois em{' '}
          <strong className="text-foreground">Ler código QR</strong>. Aponte a câmera para o
          quadrado abaixo.
        </p>
        <div className="mt-3 flex flex-col items-center gap-3">
          {configuracao ? (
            // `<img>` simples: é um `data:` gerado pela API, não há o que otimizar.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={configuracao.qrCode}
              alt="QR code para o app autenticador"
              width={200}
              height={200}
              className="rounded-lg border bg-white p-2"
            />
          ) : (
            <Esqueleto className="size-[200px] rounded-lg" />
          )}
          {configuracao && <ChaveManual segredo={configuracao.segredo} />}
        </div>
      </Passo>

      <Passo numero={3} titulo="Digite o código que apareceu no app">
        <p>
          O app vai mostrar <strong className="text-foreground">Gestão Empresarial</strong> com um
          número de 6 dígitos. Ele muda a cada 30 segundos: digite o que estiver na tela agora.
        </p>
        <form
          method="post"
          noValidate
          className="mt-3 flex flex-col gap-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            setFalha(undefined);
            const codigo = String(new FormData(evento.currentTarget).get('codigo') ?? '');
            iniciar(async () => {
              // Sucesso entra no painel; chegar aqui é erro.
              const resultado = await ativarDoisFatores(codigo);
              setFalha(resultado?.erro);
            });
          }}
        >
          {falha && <AvisoErro mensagem={falha} />}
          <CampoCodigo desabilitado={!configuracao} />
          <Botao type="submit" carregando={ativando} disabled={!configuracao}>
            Ativar e entrar
          </Botao>
        </form>
      </Passo>
    </ol>
  );
}

function Passo({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold"
      >
        {numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function ChaveManual({ segredo }: { segredo: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <details className="w-full text-sm">
      <summary className="cursor-pointer text-center underline underline-offset-4">
        A câmera não leu o código?
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-muted-foreground text-xs leading-relaxed">
          No app, toque em <strong className="text-foreground">+</strong> e depois em{' '}
          <strong className="text-foreground">Inserir chave de configuração</strong>. Em nome,
          escreva <strong className="text-foreground">Gestão Empresarial</strong> e, em chave, cole
          ou digite:
        </p>
        <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <code className="text-foreground font-mono text-xs break-all">{segredo}</code>
          <button
            type="button"
            aria-label="Copiar chave"
            title="Copiar chave"
            onClick={() => {
              void navigator.clipboard.writeText(segredo.replace(/\s/g, '')).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              });
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
          >
            {copiado ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
          </button>
        </div>
      </div>
    </details>
  );
}
