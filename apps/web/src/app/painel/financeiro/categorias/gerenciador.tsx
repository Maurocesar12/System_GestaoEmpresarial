'use client';

import {
  EXPLICACAO_TIPO_CUSTO,
  ROTULO_TIPO_CUSTO,
  TIPOS_CUSTO,
  type CategoriaFinanceira,
  type TipoCusto,
} from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoItem, CartaoLista } from '@/components/ui/cartao';
import { Selecao } from '@/components/ui/selecao';
import { Selo } from '@/components/ui/selo';
import { criarCategoria, removerCategoria } from '../acoes';

/**
 * Cor de cada classificação.
 *
 * Verde para receita porque é dinheiro entrando, e é o mesmo verde que o resto
 * do sistema usa para entrada. Azul e âmbar separam despesa previsível de
 * despesa que acompanha o movimento — a distinção que muda o custo por dia.
 */
const TOM_DO_TIPO_CUSTO = {
  receita: 'sucesso',
  fixo: 'info',
  variavel: 'atencao',
} as const satisfies Record<TipoCusto, string>;

export function GerenciadorCategorias({ categorias }: { categorias: CategoriaFinanceira[] }) {
  const [erro, setErro] = useState<string>();

  return (
    <div className="flex flex-col gap-4">
      {erro && <AvisoErro mensagem={erro} />}

      {categorias.length > 0 && (
        <Cartao>
          <CartaoLista>
            {categorias.map((categoria) => (
              <CartaoItem key={categoria.id}>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-medium">{categoria.nome}</span>

                  <Selo tom={TOM_DO_TIPO_CUSTO[categoria.tipoCusto]}>
                    {ROTULO_TIPO_CUSTO[categoria.tipoCusto]}
                  </Selo>
                </span>

                <BotaoExcluir id={categoria.id} nome={categoria.nome} onErro={setErro} />
              </CartaoItem>
            ))}
          </CartaoLista>
        </Cartao>
      )}

      <NovaCategoria onErro={setErro} />
    </div>
  );
}

function BotaoExcluir({
  id,
  nome,
  onErro,
}: {
  id: string;
  nome: string;
  onErro: (erro?: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
      >
        excluir
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Excluir {nome}?</span>
      <button
        type="button"
        disabled={excluindo}
        onClick={() =>
          iniciar(async () => {
            onErro(undefined);
            // A API recusa categoria em uso e diz quantos lançamentos dependem
            // dela — mensagem bem mais útil que "não foi possível excluir".
            const resultado = await removerCategoria(id);
            onErro(resultado.erro);
            setConfirmando(false);
          })
        }
        className="text-destructive font-medium underline-offset-4 hover:underline disabled:opacity-50"
      >
        sim
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-muted-foreground underline-offset-4 hover:underline"
      >
        não
      </button>
    </span>
  );
}

function NovaCategoria({ onErro }: { onErro: (erro?: string) => void }) {
  const [nome, setNome] = useState('');
  const [tipoCusto, setTipoCusto] = useState<TipoCusto>('variavel');
  const [criando, iniciar] = useTransition();

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();

    if (!nome.trim()) return;

    iniciar(async () => {
      onErro(undefined);
      const resultado = await criarCategoria({ nome: nome.trim(), tipoCusto });

      if (resultado.erro) {
        onErro(resultado.erro);
        return;
      }

      setNome('');
    });
  };

  return (
    <form onSubmit={enviar} method="post" className="flex flex-wrap items-end gap-3">
      <Campo
        rotulo="Nova categoria"
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        placeholder="Ex.: Combustível"
        className="w-56"
      />

      <div className="flex flex-col gap-1">
        <Selecao
          id="tipoCusto"
          rotulo="Serve para"
          value={tipoCusto}
          onChange={(evento) => setTipoCusto(evento.target.value as TipoCusto)}
          className="w-52"
        >
          {TIPOS_CUSTO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ROTULO_TIPO_CUSTO[tipo]}
            </option>
          ))}
        </Selecao>

        {/*
          A explicação acompanha a escolha porque "fixo" e "variável" são termos
          de contabilidade que o dono de PME não usa — e escolher errado aqui
          distorce o custo por dia e a margem sem nenhum sinal de que houve erro.
        */}
        <p className="text-muted-foreground max-w-52 text-xs">{EXPLICACAO_TIPO_CUSTO[tipoCusto]}</p>
      </div>

      <Botao type="submit" variante="secundario" carregando={criando}>
        Adicionar
      </Botao>
    </form>
  );
}
