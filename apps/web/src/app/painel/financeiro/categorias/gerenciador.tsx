'use client';

import { ROTULO_TIPO_CUSTO, type CategoriaFinanceira, type TipoCusto } from '@gestao/shared-types';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoItem, CartaoLista } from '@/components/ui/cartao';
import { Selecao } from '@/components/ui/selecao';
import { Selo } from '@/components/ui/selo';
import { criarCategoria, removerCategoria } from '../acoes';

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

                  {/* Azul para fixo, âmbar para variável — os mesmos tons de
                    significado dos selos do resto do sistema. */}
                  <Selo tom={categoria.tipoCusto === 'fixo' ? 'info' : 'atencao'}>
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

      <Selecao
        id="tipoCusto"
        rotulo="Tipo de custo"
        value={tipoCusto}
        onChange={(evento) => setTipoCusto(evento.target.value as TipoCusto)}
        className="w-44"
      >
        <option value="variavel">{ROTULO_TIPO_CUSTO.variavel}</option>
        <option value="fixo">{ROTULO_TIPO_CUSTO.fixo}</option>
      </Selecao>

      <Botao type="submit" variante="secundario" carregando={criando}>
        Adicionar
      </Botao>
    </form>
  );
}
