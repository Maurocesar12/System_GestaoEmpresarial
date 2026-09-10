'use client';

import {
  formatarBRL,
  GRUPOS_PERMISSOES,
  PERMISSOES_PADRAO_POR_PAPEL,
  type ConviteEquipe,
  type Funcionario,
  type EquipeResponse,
  type PapelUsuario,
  type Permissao,
} from '@gestao/shared-types';
import { ArrowUpRight, Mail, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Selecao } from '@/components/ui/selecao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { atualizarFuncionario, cancelarConvite, convidarFuncionario } from './acoes';

const ROTULOS: Record<PapelUsuario, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  atendente: 'Atendente',
  tecnico: 'Técnico',
};

export function GerenciadorEquipe({ funcionarios, convites, capacidade }: EquipeResponse) {
  const limiteAtingido = capacidade.vagasDisponiveis === 0;

  return (
    <div className="flex flex-col gap-6">
      <ResumoPlano capacidade={capacidade} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-3">
          {funcionarios.map((funcionario) => (
            <FormularioFuncionario key={funcionario.id} funcionario={funcionario} />
          ))}
        </div>
        <div className="flex flex-col gap-6">
          <FormularioConvite bloqueado={limiteAtingido} capacidade={capacidade} />
          {convites.length > 0 && <ConvitesPendentes convites={convites} />}
        </div>
      </div>
    </div>
  );
}

function ResumoPlano({ capacidade }: { capacidade: EquipeResponse['capacidade'] }) {
  const percentual =
    capacidade.limiteUsuarios === null
      ? 0
      : Math.min(100, Math.round((capacidade.vagasOcupadas / capacidade.limiteUsuarios) * 100));

  return (
    <Cartao>
      <CartaoConteudo className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Plano da equipe
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{capacidade.planoNome}</h2>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  Nível {capacidade.planoNivel}
                </span>
                {capacidade.planoDestaque && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                    recomendado
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                {capacidade.planoDescricao}
              </p>
            </div>

            <div className="text-right">
              <p className="text-muted-foreground text-xs">Mensalidade estimada</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatarBRL(capacidade.mensalidadeEstimada)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricaPlano
              rotulo="Usuários ativos"
              valor={String(capacidade.usuariosAtivos)}
              detalhe={`${capacidade.usuariosInclusos ?? 'Todos'} incluídos`}
            />
            <MetricaPlano
              rotulo="Convites pendentes"
              valor={String(capacidade.convitesPendentes)}
              detalhe="Reservam vaga"
            />
            <MetricaPlano
              rotulo="Vagas disponíveis"
              valor={capacidade.vagasDisponiveis === null ? 'Sem limite' : String(capacidade.vagasDisponiveis)}
              detalhe={
                capacidade.limiteUsuarios === null
                  ? 'Sem teto definido'
                  : `${capacidade.vagasOcupadas}/${capacidade.limiteUsuarios} ocupadas`
              }
            />
          </div>

          {capacidade.limiteUsuarios !== null && (
            <div className="flex flex-col gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-[width]"
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Convites contam no limite para evitar vender mais acesso do que o plano permite.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <p className="text-sm font-semibold">Cobrança de usuários</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <ItemCobranca rotulo="Base" valor={formatarBRL(capacidade.precoBase)} />
            <ItemCobranca
              rotulo="Adicionais"
              valor={formatarBRL(capacidade.adicionalUsuarios)}
            />
            <ItemCobranca
              rotulo="Por adicional"
              valor={formatarBRL(capacidade.precoPorUsuarioAdicional)}
            />
            <ItemCobranca
              rotulo="Usuários extras"
              valor={String(capacidade.usuariosAdicionais)}
            />
          </dl>

          {capacidade.proximoPlano && (
            <div className="mt-4 rounded-md border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Próximo: {capacidade.proximoPlano.nome}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatarBRL(capacidade.proximoPlano.preco)}/mês · até{' '}
                    {capacidade.proximoPlano.limiteUsuarios ?? 'sem limite'} usuários
                  </p>
                </div>
                <ArrowUpRight className="text-muted-foreground size-4" />
              </div>
            </div>
          )}
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}

function MetricaPlano({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      <p className="text-muted-foreground mt-1 text-xs">{detalhe}</p>
    </div>
  );
}

function ItemCobranca({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

function FormularioFuncionario({ funcionario }: { funcionario: Funcionario }) {
  const [papel, setPapel] = useState<PapelUsuario>(funcionario.papel);
  const [permissoes, setPermissoes] = useState<Permissao[]>(funcionario.permissoes);
  const [falha, setFalha] = useState<string>();
  const [salvando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  function trocarPapel(novo: PapelUsuario) {
    setPapel(novo);
    setPermissoes([...PERMISSOES_PADRAO_POR_PAPEL[novo]]);
  }

  return (
    <Cartao>
      <CartaoCabecalho>
        <div className="min-w-0">
          <CartaoTitulo>{funcionario.nome}</CartaoTitulo>
          <p className="text-muted-foreground truncate text-xs">{funcionario.email}</p>
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs ${funcionario.ativo ? 'text-sucesso' : 'text-muted-foreground'}`}
        >
          {funcionario.ativo ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
          {funcionario.ativo ? 'Ativo' : 'Desativado'}
        </span>
      </CartaoCabecalho>
      <CartaoConteudo>
        <details>
          <summary className="text-primary cursor-pointer text-sm font-medium">
            Editar acesso
          </summary>
          <form
            className="mt-5 flex flex-col gap-5"
            onSubmit={(evento) => {
              evento.preventDefault();
              setFalha(undefined);
              const form = new FormData(evento.currentTarget);
              iniciar(async () => {
                const resultado = await atualizarFuncionario(funcionario.id, {
                  nome: String(form.get('nome')),
                  papel,
                  ativo: form.get('ativo') === 'on',
                  permissoes,
                });
                setFalha(resultado.erro);
                if (!resultado.erro) avisar('sucesso', 'Acesso do funcionário atualizado.');
              });
            }}
          >
            {falha && <AvisoErro mensagem={falha} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo name="nome" rotulo="Nome" defaultValue={funcionario.nome} />
              <Selecao
                name="papel"
                rotulo="Papel base"
                value={papel}
                onChange={(e) => trocarPapel(e.target.value as PapelUsuario)}
              >
                {Object.entries(ROTULOS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Selecao>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="ativo" type="checkbox" defaultChecked={funcionario.ativo} /> Funcionário
              ativo
            </label>
            <GradePermissoes selecionadas={permissoes} aoMudar={setPermissoes} />
            <Botao type="submit" carregando={salvando} className="self-start">
              Salvar acesso
            </Botao>
          </form>
        </details>
      </CartaoConteudo>
    </Cartao>
  );
}

function FormularioConvite({
  bloqueado,
  capacidade,
}: {
  bloqueado: boolean;
  capacidade: EquipeResponse['capacidade'];
}) {
  const [papel, setPapel] = useState<PapelUsuario>('atendente');
  const [permissoes, setPermissoes] = useState<Permissao[]>([
    ...PERMISSOES_PADRAO_POR_PAPEL.atendente,
  ]);
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const { avisar } = useAvisos();
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo className="flex items-center gap-2">
          <UserPlus className="size-4" />
          Convidar funcionário
        </CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo>
        {bloqueado && (
          <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Limite de usuários atingido neste plano.</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Cancele um convite pendente, desative alguém sem acesso ou migre para{' '}
              {capacidade.proximoPlano?.nome ?? 'um plano superior'} para liberar novas vagas.
            </p>
          </div>
        )}
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            setFalha(undefined);
            const formulario = evento.currentTarget;
            const form = new FormData(formulario);
            iniciar(async () => {
              if (bloqueado) {
                setFalha('O limite de usuários do plano foi atingido.');
                return;
              }

              const resultado = await convidarFuncionario({
                nome: String(form.get('nome')),
                email: String(form.get('email')),
                papel: papel === 'admin' ? 'atendente' : papel,
                permissoes,
              });
              setFalha(resultado.erro);
              if (!resultado.erro) {
                formulario.reset();
                setPapel('atendente');
                setPermissoes([...PERMISSOES_PADRAO_POR_PAPEL.atendente]);
                avisar('sucesso', 'Convite enviado por e-mail.');
              }
            });
          }}
        >
          {falha && <AvisoErro mensagem={falha} />}
          <Campo name="nome" rotulo="Nome" placeholder="Maria Silva" />
          <Campo name="email" type="email" rotulo="E-mail" placeholder="maria@empresa.com" />
          <Selecao
            rotulo="Papel base"
            value={papel}
            onChange={(e) => {
              const valor = e.target.value as PapelUsuario;
              setPapel(valor);
              setPermissoes([...PERMISSOES_PADRAO_POR_PAPEL[valor]]);
            }}
          >
            {(['atendente', 'financeiro', 'tecnico'] as const).map((valor) => (
              <option key={valor} value={valor}>
                {ROTULOS[valor]}
              </option>
            ))}
          </Selecao>
          <details>
            <summary className="text-primary cursor-pointer text-sm">
              Personalizar permissões
            </summary>
            <div className="mt-4">
              <GradePermissoes selecionadas={permissoes} aoMudar={setPermissoes} />
            </div>
          </details>
          <Botao type="submit" carregando={enviando} disabled={bloqueado}>
            <Mail />
            Enviar convite
          </Botao>
        </form>
      </CartaoConteudo>
    </Cartao>
  );
}

function GradePermissoes({
  selecionadas,
  aoMudar,
}: {
  selecionadas: Permissao[];
  aoMudar: (valor: Permissao[]) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {GRUPOS_PERMISSOES.map((grupo) => (
        <fieldset key={grupo.titulo} className="rounded-md border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide">
            {grupo.titulo}
          </legend>
          <div className="flex flex-col gap-2">
            {grupo.itens.map((item) => (
              <label key={item.codigo} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(item.codigo)}
                  onChange={(e) =>
                    aoMudar(
                      e.target.checked
                        ? [...selecionadas, item.codigo]
                        : selecionadas.filter((codigo) => codigo !== item.codigo),
                    )
                  }
                  className="mt-0.5"
                />
                {item.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function ConvitesPendentes({ convites }: { convites: ConviteEquipe[] }) {
  const [falha, setFalha] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  const { avisar } = useAvisos();
  return (
    <Cartao>
      <CartaoCabecalho>
        <CartaoTitulo>Convites pendentes</CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo className="flex flex-col gap-3">
        {falha && <AvisoErro mensagem={falha} />}
        {convites.map((convite) => (
          <div
            key={convite.id}
            className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{convite.nome}</p>
              <p className="text-muted-foreground truncate text-xs">
                {convite.email} · {ROTULOS[convite.papel]}
              </p>
            </div>
            <button
              type="button"
              disabled={ocupado}
              className="text-destructive text-xs hover:underline"
              onClick={() =>
                iniciar(async () => {
                  const resultado = await cancelarConvite(convite.id);
                  setFalha(resultado.erro);
                  if (!resultado.erro) avisar('sucesso', 'Convite cancelado.');
                })
              }
            >
              Cancelar
            </button>
          </div>
        ))}
      </CartaoConteudo>
    </Cartao>
  );
}
