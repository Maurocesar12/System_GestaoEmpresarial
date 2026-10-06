'use client';

import { Check, Copy, Download, KeyRound, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao, estilosBotao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Esqueleto } from '@/components/ui/esqueleto';
import { cn } from '@/lib/utils';
import { ativarDoisFatores, prepararConfiguracao, type ResultadoConfiguracao } from '../../acoes';

type Configuracao = NonNullable<ResultadoConfiguracao['configuracao']>;

/**
 * Configuração do app autenticador, em duas fases na mesma tela.
 *
 * 1. Escanear o QR e confirmar o primeiro código.
 * 2. Guardar os códigos de recuperação — mostrados uma vez só.
 *
 * O QR é pedido ao montar, e uma vez só: a cada pedido a API gera um segredo
 * novo, e o React em modo estrito monta o componente duas vezes em
 * desenvolvimento. Dois segredos seguidos deixariam o QR na tela diferente do
 * que a API espera.
 */
export function ConfigurarDoisFatores() {
  const pedido = useRef(false);
  const [configuracao, setConfiguracao] = useState<Configuracao>();
  const [codigos, setCodigos] = useState<string[]>();
  const [falha, setFalha] = useState<string>();
  const [expirou, setExpirou] = useState(false);
  const [ocupado, iniciar] = useTransition();

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

  if (codigos) return <CodigosRecuperacao codigos={codigos} />;

  if (expirou) {
    return (
      <div className="flex flex-col gap-4">
        <AvisoErro mensagem={falha ?? 'A verificação expirou.'} />
        <Link href="/entrar" className={estilosBotao()}>
          Entrar de novo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Passo numero={1} icone={Smartphone} titulo="Instale um app autenticador">
        Google Authenticator, Microsoft Authenticator ou Authy — gratuitos na loja do celular.
      </Passo>

      <Passo numero={2} icone={KeyRound} titulo="Escaneie o QR code com o app">
        <div className="mt-3 flex flex-col items-center gap-3">
          {configuracao ? (
            // `<img>` simples: é um `data:` gerado pela API, não há o que otimizar.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={configuracao.qrCode}
              alt="QR code para configurar o app autenticador"
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

      <form
        method="post"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          setFalha(undefined);
          const codigo = String(new FormData(evento.currentTarget).get('codigo') ?? '');
          iniciar(async () => {
            const resultado = await ativarDoisFatores(codigo);
            if (resultado.codigosRecuperacao) setCodigos(resultado.codigosRecuperacao);
            else setFalha(resultado.erro);
          });
        }}
      >
        {falha && <AvisoErro mensagem={falha} />}
        <Campo
          name="codigo"
          rotulo="3. Digite o código que aparece no app"
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={!configuracao}
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
        <Botao type="submit" carregando={ocupado} disabled={!configuracao}>
          Ativar e continuar
        </Botao>
      </form>
    </div>
  );
}

function Passo({
  numero,
  icone: Icone,
  titulo,
  children,
}: {
  numero: number;
  icone: typeof Smartphone;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="flex gap-3">
      <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full">
        <Icone aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-sm font-medium">
          {numero}. {titulo}
        </h2>
        <div className="text-muted-foreground text-sm">{children}</div>
      </div>
    </section>
  );
}

function ChaveManual({ segredo }: { segredo: string }) {
  return (
    <details className="w-full text-xs">
      <summary className="cursor-pointer text-center underline underline-offset-4">
        Não consegue escanear? Digite a chave
      </summary>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <code className="text-foreground font-mono text-xs break-all">{segredo}</code>
        <BotaoCopiar texto={segredo.replace(/\s/g, '')} rotulo="Copiar chave" />
      </div>
    </details>
  );
}

function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        });
      }}
      className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
    >
      {copiado ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
    </button>
  );
}

/** A segunda fase: a sessão já está aberta, falta só guardar os códigos. */
function CodigosRecuperacao({ codigos }: { codigos: string[] }) {
  const [guardou, setGuardou] = useState(false);
  const texto = codigos.join('\n');

  function baixar() {
    const arquivo = new Blob(
      [`Códigos de recuperação — Gestão Empresarial\nCada código vale uma vez.\n\n${texto}\n`],
      { type: 'text/plain;charset=utf-8' },
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(arquivo);
    link.download = 'codigos-recuperacao.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-sucesso-suave border-sucesso/25 flex items-start gap-3 rounded-lg border p-3 text-sm">
        <Check aria-hidden className="text-sucesso mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-medium">Verificação em duas etapas ativada.</span>{' '}
          <span className="text-muted-foreground">
            Agora guarde os códigos abaixo: eles entram no lugar do app se você perder o celular.
            Esta é a única vez que eles aparecem.
          </span>
        </p>
      </div>

      <ul
        aria-label="Códigos de recuperação"
        className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm"
      >
        {codigos.map((codigo) => (
          <li key={codigo} className="text-center">
            {codigo}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Botao type="button" variante="secundario" onClick={baixar}>
          <Download aria-hidden />
          Baixar
        </Botao>
        <Botao
          type="button"
          variante="secundario"
          onClick={() => void navigator.clipboard.writeText(texto)}
        >
          <Copy aria-hidden />
          Copiar
        </Botao>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={guardou}
          onChange={(evento) => setGuardou(evento.target.checked)}
          className="accent-primary mt-0.5 size-4 shrink-0"
        />
        Guardei os códigos em um lugar seguro.
      </label>

      <Link
        href="/painel"
        aria-disabled={!guardou}
        tabIndex={guardou ? undefined : -1}
        onClick={(evento) => {
          if (!guardou) evento.preventDefault();
        }}
        className={cn(estilosBotao(), !guardou && 'pointer-events-none opacity-50')}
      >
        Continuar para o painel
      </Link>
    </div>
  );
}
