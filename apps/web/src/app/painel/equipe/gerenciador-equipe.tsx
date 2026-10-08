'use client';

import {
  ROTULO_PAPEL,
  type CatalogoAcessos,
  type EquipeResponse,
  type Funcionario,
  type MapaAcessos,
  type PapelUsuario,
} from '@gestao/shared-types';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoTitulo } from '@/components/ui/cartao';
import { Selo } from '@/components/ui/selo';
import { ResumoPlano } from './resumo-plano';
import { PainelFuncionario } from './painel-funcionario';
import { FormularioConvite, ConvitesPendentes } from './formulario-convite';

export function GerenciadorEquipe({
  funcionarios,
  convites,
  capacidade,
  catalogo,
  mostrarComissoes,
  ehAdmin,
}: EquipeResponse & {
  /** Percentuais de comissão são só do admin; a API também recusa os demais. */
  mostrarComissoes: boolean;
  /** Mostra "Redefinir 2FA". A API só aceita do admin, com ou sem o botão. */
  ehAdmin: boolean;
}) {
  const [editando, setEditando] = useState<Funcionario>();

  return (
    <div className="flex flex-col gap-6">
      <ResumoPlano capacidade={capacidade} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Equipe</CartaoTitulo>
            <span className="text-muted-foreground text-xs">
              {funcionarios.length} {funcionarios.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </CartaoCabecalho>
          <ul className="divide-y">
            {funcionarios.map((funcionario) => (
              <LinhaFuncionario
                key={funcionario.id}
                funcionario={funcionario}
                catalogo={catalogo}
                aoEditar={() => setEditando(funcionario)}
              />
            ))}
          </ul>
        </Cartao>
        <div className="flex flex-col gap-6">
          <FormularioConvite
            bloqueado={capacidade.limiteAtingido}
            capacidade={capacidade}
            catalogo={catalogo}
          />
          {convites.length > 0 && <ConvitesPendentes convites={convites} />}
        </div>
      </div>

      {editando && (
        <PainelFuncionario
          // A chave recria o estado do painel ao trocar de pessoa.
          key={editando.id}
          funcionario={editando}
          catalogo={catalogo}
          mostrarComissoes={mostrarComissoes}
          ehAdmin={ehAdmin}
          aoFechar={() => setEditando(undefined)}
        />
      )}
    </div>
  );
}

function LinhaFuncionario({
  funcionario,
  catalogo,
  aoEditar,
}: {
  funcionario: Funcionario;
  catalogo: CatalogoAcessos;
  aoEditar: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
      <Iniciais nome={funcionario.nome} apagado={!funcionario.ativo} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{funcionario.nome}</span>
            <Selo tom={funcionario.papel === 'admin' ? 'info' : 'neutro'}>
              {ROTULO_PAPEL[funcionario.papel]}
            </Selo>
            {funcionario.permissoesPersonalizadas && <Selo tom="atencao">Personalizado</Selo>}
            {!funcionario.ativo && <Selo tom="perigo">Desativado</Selo>}
            {funcionario.ativo && !funcionario.doisFatoresAtivo && (
              <Selo tom="neutro" title="Configura o app autenticador no próximo login">
                2FA pendente
              </Selo>
            )}
          </div>
          <span className="text-muted-foreground truncate text-xs">{funcionario.email}</span>
        </div>
        <ResumoAcesso papel={funcionario.papel} acessos={funcionario.acessos} catalogo={catalogo} />
      </div>
      <Botao
        type="button"
        variante="secundario"
        tamanho="sm"
        onClick={aoEditar}
        className="self-start"
      >
        <SlidersHorizontal aria-hidden />
        Editar acesso
      </Botao>
    </li>
  );
}

function Iniciais({ nome, apagado }: { nome: string; apagado: boolean }) {
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte[0])
    .filter((_, indice, todas) => indice === 0 || indice === todas.length - 1)
    .join('')
    .toUpperCase();

  return (
    <span
      aria-hidden
      className={`bg-muted grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${apagado ? 'text-muted-foreground/60' : 'text-foreground'}`}
    >
      {iniciais}
    </span>
  );
}

/** O que a pessoa acessa, área por área, lido do que a API devolveu. */
function ResumoAcesso({
  papel,
  acessos,
  catalogo,
}: {
  papel: PapelUsuario;
  acessos: MapaAcessos;
  catalogo: CatalogoAcessos;
}) {
  if (papel === 'admin') {
    return <p className="text-muted-foreground text-xs">Acesso total ao sistema.</p>;
  }

  const itens = catalogo.areas.flatMap((area) => {
    const acesso = acessos[area.id];
    const nivel = area.niveis.find((item) => item.nivel === acesso.nivel);
    if (!nivel && acesso.extras.length === 0) return [];
    return [
      { id: area.id, titulo: area.titulo, nivel: nivel?.rotulo, extras: acesso.extras.length },
    ];
  });

  if (itens.length === 0) {
    return <p className="text-muted-foreground text-xs">Sem acesso a nenhuma área.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Acesso por área">
      {itens.map((item) => (
        <li key={item.id} className="bg-muted/60 rounded-md px-2 py-0.5 text-xs">
          {item.titulo}
          {item.nivel && <span className="text-muted-foreground"> · {item.nivel}</span>}
          {item.extras > 0 && <span className="text-muted-foreground"> +{item.extras}</span>}
        </li>
      ))}
    </ul>
  );
}
