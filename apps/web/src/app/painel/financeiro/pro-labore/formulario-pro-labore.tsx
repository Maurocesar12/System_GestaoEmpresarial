'use client';

import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import type { ResultadoAcao } from '@/lib/acoes';
import { definirProLabore } from './acoes';

/**
 * Define um novo valor de pró-labore.
 *
 * Formulário curto o bastante para não valer React Hook Form: dois campos, e o
 * erro que importa vem da API (data repetida), não da validação local.
 *
 * A data já vem preenchida com o primeiro dia do mês que vem, porque é quando
 * um reajuste de retirada normalmente passa a valer — mudar no meio do mês
 * partiria o mês em duas vigências e complicaria a conferência com o contador.
 */
export function FormularioProLabore({ sugestao }: { sugestao: string }) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [enviando, iniciarEnvio] = useTransition();
  const [valor, setValor] = useState('');

  return (
    <form
      className="flex flex-col gap-4"
      action={(dados) => {
        setFalha(undefined);

        iniciarEnvio(async () => {
          const resultado = await definirProLabore({
            valor: String(dados.get('valor') ?? ''),
            vigenciaInicio: String(dados.get('vigenciaInicio') ?? ''),
          });

          if (resultado.erro) {
            setFalha(resultado);
            return;
          }

          setValor('');
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          name="valor"
          rotulo="Novo valor mensal"
          inputMode="decimal"
          placeholder="0,00"
          required
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
          erro={falha?.campos?.valor?.[0]}
          ajuda={`Sugestão do sistema: ${sugestao}`}
        />

        <Campo
          name="vigenciaInicio"
          rotulo="Vale a partir de"
          type="date"
          required
          defaultValue={primeiroDiaDoProximoMes()}
          erro={falha?.campos?.vigenciaInicio?.[0]}
          ajuda="O valor anterior fica no histórico."
        />
      </div>

      {falha?.erro && <AvisoErro mensagem={falha.erro} detalhes={falha.campos} />}

      <Botao type="submit" carregando={enviando} className="w-fit">
        Definir pró-labore
      </Botao>
    </form>
  );
}

function primeiroDiaDoProximoMes(): string {
  const agora = new Date();
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const p = (n: number) => String(n).padStart(2, '0');

  return `${proximo.getFullYear()}-${p(proximo.getMonth() + 1)}-01`;
}
