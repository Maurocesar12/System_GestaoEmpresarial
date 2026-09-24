'use client';

import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Botao } from '@/components/ui/botao';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { gerarChaveMarketing } from './acoes';

/**
 * O formulário para colar no site do assinante.
 *
 * O trecho é HTML puro, sem script hospedado por nós: o assinante cola e
 * funciona, sem depender de um arquivo nosso continuar no ar nem de a página
 * dele carregar um domínio de terceiro. O custo é um trecho mais longo; o
 * ganho é não ter uma dependência viva entre o site dele e a nossa infra.
 */
export function FormularioEmbed({
  chave,
  urlApi,
  podeGerar,
}: {
  chave: string | null;
  urlApi: string;
  podeGerar: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string>();
  const [gerando, iniciar] = useTransition();

  const trecho = chave ? montarTrecho(chave, urlApi) : '';

  function copiar() {
    void navigator.clipboard.writeText(trecho).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  function gerar() {
    iniciar(async () => {
      const resultado = await gerarChaveMarketing();
      setErro(resultado.erro);
    });
  }

  if (!chave) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">
          Gere uma chave para receber leads direto do seu site. Quem preencher o formulário entra na
          primeira etapa do funil, já com a origem marcada.
        </p>
        {erro && <AvisoErro mensagem={erro} />}
        {podeGerar ? (
          <Botao onClick={gerar} carregando={gerando}>
            <KeyRound aria-hidden className="size-4" />
            Gerar chave do formulário
          </Botao>
        ) : (
          <p className="text-muted-foreground text-xs">Só o administrador pode gerar a chave.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="bg-muted rounded-md px-2.5 py-1 font-mono text-xs break-all">{chave}</code>
        {podeGerar && (
          <Botao variante="secundario" tamanho="sm" onClick={gerar} carregando={gerando}>
            <RefreshCw aria-hidden className="size-3.5" />
            Gerar nova
          </Botao>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Gerar uma chave nova invalida esta na hora — é assim que você corta um formulário que
        começou a receber cadastro falso.
      </p>

      {erro && <AvisoErro mensagem={erro} />}

      <div className="relative">
        <pre className="bg-muted/60 max-h-80 overflow-auto rounded-lg border p-3 text-xs leading-relaxed">
          <code>{trecho}</code>
        </pre>
        <Botao
          variante="secundario"
          tamanho="sm"
          onClick={copiar}
          className="absolute top-2 right-2"
        >
          {copiado ? (
            <>
              <Check aria-hidden className="size-3.5" />
              Copiado
            </>
          ) : (
            <>
              <Copy aria-hidden className="size-3.5" />
              Copiar
            </>
          )}
        </Botao>
      </div>
    </div>
  );
}

/**
 * O HTML que o assinante cola.
 *
 * Três detalhes que não são enfeite:
 *
 * - O campo `sobrenome_confirmacao` fica escondido e precisa continuar vazio.
 *   É a armadilha que separa robô de gente, e o servidor descarta em silêncio
 *   quem o preenche.
 * - O consentimento é obrigatório: sem base legal registrada não há por que
 *   guardar o dado (LGPD).
 * - Os parâmetros UTM da própria URL vão junto, o que é o que faz o relatório
 *   por origem ter o que mostrar.
 */
function montarTrecho(chave: string, urlApi: string): string {
  return `<form id="lead-gestao">
  <input name="nome" placeholder="Seu nome" required />
  <input name="email" type="email" placeholder="Seu e-mail" />
  <input name="telefone" placeholder="Seu telefone" />
  <textarea name="mensagem" placeholder="Como podemos ajudar?"></textarea>

  <!-- Campo-armadilha: mantenha escondido e vazio. -->
  <input name="sobrenome_confirmacao" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px" aria-hidden="true" />

  <label>
    <input name="consentimento" type="checkbox" required />
    Autorizo o contato e o uso dos meus dados.
  </label>

  <button type="submit">Enviar</button>
  <p id="lead-gestao-status" role="status"></p>
</form>

<script>
document.getElementById('lead-gestao').addEventListener('submit', async function (evento) {
  evento.preventDefault();

  var form = evento.target;
  var status = document.getElementById('lead-gestao-status');
  var utm = new URLSearchParams(location.search);

  status.textContent = 'Enviando...';

  try {
    await fetch('${urlApi}/publico/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chave: '${chave}',
        nome: form.nome.value,
        email: form.email.value,
        telefone: form.telefone.value,
        mensagem: form.mensagem.value,
        sobrenome_confirmacao: form.sobrenome_confirmacao.value,
        consentimento: form.consentimento.checked,
        utmSource: utm.get('utm_source'),
        utmMedium: utm.get('utm_medium'),
        utmCampaign: utm.get('utm_campaign')
      })
    });

    form.reset();
    status.textContent = 'Recebemos seu contato. Retornaremos em breve.';
  } catch (erro) {
    status.textContent = 'Nao foi possivel enviar. Tente novamente.';
  }
});
</script>`;
}
