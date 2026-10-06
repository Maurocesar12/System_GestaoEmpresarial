'use client';

import {
  formatarBRL,
  ROTULO_PAPEL,
  type CatalogoAcessos,
  type ConviteEquipe,
  type EquipeResponse,
  type Funcionario,
  type MapaAcessos,
  type PapelUsuario,
} from '@gestao/shared-types';
import { ArrowUpRight, Mail, ShieldCheck, SlidersHorizontal, UserPlus } from 'lucide-react';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { SeletorSegmentado } from '@/components/ui/seletor-segmentado';
import { Selo } from '@/components/ui/selo';
import {
  atualizarFuncionario,
  cancelarConvite,
  convidarFuncionario,
  redefinirDoisFatores,
} from './acoes';
import { EditorAcessos, mesmosAcessos } from './editor-acessos';

const TODOS_OS_PAPEIS: readonly PapelUsuario[] = ['admin', 'financeiro', 'atendente', 'tecnico'];
/** Convite nunca cria administrador — a API recusa; a tela nem oferece. */
const PAPEIS_CONVITE = ['atendente', 'financeiro', 'tecnico'] as const;

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

function ResumoPlano({ capacidade }: { capacidade: EquipeResponse['capacidade'] }) {
  const percentual = capacidade.percentualOcupado;

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
              valor={
                capacidade.vagasDisponiveis === null
                  ? 'Sem limite'
                  : String(capacidade.vagasDisponiveis)
              }
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
            <ItemCobranca rotulo="Adicionais" valor={formatarBRL(capacidade.adicionalUsuarios)} />
            <ItemCobranca
              rotulo="Por adicional"
              valor={formatarBRL(capacidade.precoPorUsuarioAdicional)}
            />
            <ItemCobranca rotulo="Usuários extras" valor={String(capacidade.usuariosAdicionais)} />
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

function MetricaPlano({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
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

function PainelFuncionario({
  funcionario,
  catalogo,
  mostrarComissoes,
  ehAdmin,
  aoFechar,
}: {
  funcionario: Funcionario;
  catalogo: CatalogoAcessos;
  mostrarComissoes: boolean;
  ehAdmin: boolean;
  aoFechar: () => void;
}) {
  const idFormulario = useId();
  const [papel, setPapel] = useState<PapelUsuario>(funcionario.papel);
  const [acessos, setAcessos] = useState<MapaAcessos>(funcionario.acessos);
  const [falha, setFalha] = useState<string>();
  const [salvando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  return (
    <PainelLateral
      titulo={`Acesso de ${funcionario.nome}`}
      descricao={funcionario.email}
      aoFechar={aoFechar}
      rodape={
        <>
          <p className="text-muted-foreground text-xs">
            Se o acesso mudar, a pessoa precisa entrar de novo.
          </p>
          <div className="flex gap-2">
            <Botao type="button" variante="sutil" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idFormulario} carregando={salvando}>
              Salvar
            </Botao>
          </div>
        </>
      }
    >
      <form
        id={idFormulario}
        className="flex flex-col gap-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          setFalha(undefined);
          const form = new FormData(evento.currentTarget);
          iniciar(async () => {
            const resultado = await atualizarFuncionario(funcionario.id, {
              nome: String(form.get('nome')),
              papel,
              ativo: form.get('ativo') === 'on',
              acessos,
              ...(mostrarComissoes
                ? {
                    comissaoVendaPercentual: String(form.get('comissaoVenda') ?? ''),
                    comissaoExecucaoPercentual: String(form.get('comissaoExecucao') ?? ''),
                  }
                : {}),
            });
            setFalha(resultado.erro);
            if (!resultado.erro) {
              avisar('sucesso', 'Acesso do funcionário atualizado.');
              aoFechar();
            }
          });
        }}
      >
        {falha && <AvisoErro mensagem={falha} />}

        <SecaoPainel titulo="Dados">
          <Campo name="nome" rotulo="Nome" defaultValue={funcionario.nome} />
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={funcionario.ativo}
              className="accent-primary mt-0.5 size-4 shrink-0"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Funcionário ativo</span>
              <span className="text-muted-foreground text-xs">
                Desativado, não entra no sistema e libera a vaga do plano.
              </span>
            </span>
          </label>
        </SecaoPainel>

        {mostrarComissoes && (
          <SecaoPainel titulo="Comissão">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                name="comissaoVenda"
                rotulo="Venda (%)"
                inputMode="decimal"
                placeholder="Sem comissão"
                ajuda="Sobre orçamentos aprovados em que é vendedor."
                defaultValue={funcionario.comissaoVendaPercentual?.replace('.', ',') ?? ''}
              />
              <Campo
                name="comissaoExecucao"
                rotulo="Execução (%)"
                inputMode="decimal"
                placeholder="Sem comissão"
                ajuda="Sobre serviços executados em que é técnico."
                defaultValue={funcionario.comissaoExecucaoPercentual?.replace('.', ',') ?? ''}
              />
            </div>
          </SecaoPainel>
        )}

        <SecaoPainel titulo="Acesso">
          <EditorAcessos
            catalogo={catalogo}
            papel={papel}
            papeisPermitidos={TODOS_OS_PAPEIS}
            aoTrocarPapel={(novo) => {
              setPapel(novo);
              setAcessos(catalogo.padraoPorPapel[novo]);
            }}
            acessos={acessos}
            aoMudar={setAcessos}
          />
        </SecaoPainel>

        <SecaoPainel titulo="Verificação em duas etapas">
          <DoisFatoresDoFuncionario
            funcionario={funcionario}
            podeRedefinir={ehAdmin}
            aoRedefinir={aoFechar}
          />
        </SecaoPainel>
      </form>
    </PainelLateral>
  );
}

/**
 * Situação do 2FA e, para o admin, a saída de quem perdeu o celular.
 *
 * Redefinir derruba as sessões da pessoa e faz o próximo login pedir a
 * configuração do app de novo — por isso a confirmação antes.
 */
function DoisFatoresDoFuncionario({
  funcionario,
  podeRedefinir,
  aoRedefinir,
}: {
  funcionario: Funcionario;
  podeRedefinir: boolean;
  aoRedefinir: () => void;
}) {
  const [falha, setFalha] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  const { avisar } = useAvisos();

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      {falha && <AvisoErro mensagem={falha} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 text-sm">
          <ShieldCheck
            aria-hidden
            className={`mt-0.5 size-4 shrink-0 ${funcionario.doisFatoresAtivo ? 'text-sucesso' : 'text-muted-foreground'}`}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">
              {funcionario.doisFatoresAtivo
                ? 'App autenticador configurado'
                : 'Ainda não configurado'}
            </span>
            <span className="text-muted-foreground text-xs">
              {funcionario.doisFatoresAtivo
                ? 'Perdeu o celular e os códigos de recuperação? Redefina para configurar de novo.'
                : 'A configuração é pedida no próximo login.'}
            </span>
          </span>
        </div>
        {podeRedefinir && funcionario.doisFatoresAtivo && (
          <Botao
            type="button"
            variante="secundario"
            tamanho="sm"
            carregando={ocupado}
            onClick={() => {
              const confirmou = window.confirm(
                `Redefinir a verificação em duas etapas de ${funcionario.nome}? As sessões abertas serão encerradas e o app precisará ser configurado de novo no próximo login.`,
              );
              if (!confirmou) return;
              setFalha(undefined);
              iniciar(async () => {
                const resultado = await redefinirDoisFatores(funcionario.id);
                setFalha(resultado.erro);
                if (!resultado.erro) {
                  avisar('sucesso', 'Verificação em duas etapas redefinida.');
                  aoRedefinir();
                }
              });
            }}
          >
            Redefinir
          </Botao>
        )}
      </div>
    </div>
  );
}

function SecaoPainel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function FormularioConvite({
  bloqueado,
  capacidade,
  catalogo,
}: {
  bloqueado: boolean;
  capacidade: EquipeResponse['capacidade'];
  catalogo: CatalogoAcessos;
}) {
  const [papel, setPapel] = useState<PapelUsuario>('atendente');
  const [acessos, setAcessos] = useState<MapaAcessos>(catalogo.padraoPorPapel.atendente);
  const [personalizando, setPersonalizando] = useState(false);
  const [falha, setFalha] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  const descricaoPapel = catalogo.papeis.find((item) => item.papel === papel)?.descricao;
  const personalizado = !mesmosAcessos(acessos, catalogo.padraoPorPapel[papel]);

  function trocarPapel(novo: PapelUsuario) {
    setPapel(novo);
    setAcessos(catalogo.padraoPorPapel[novo]);
  }

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
              const resultado = await convidarFuncionario({
                nome: String(form.get('nome')),
                email: String(form.get('email')),
                papel: papel === 'admin' ? 'atendente' : papel,
                acessos,
              });
              setFalha(resultado.erro);
              if (!resultado.erro) {
                formulario.reset();
                trocarPapel('atendente');
                avisar('sucesso', 'Convite enviado por e-mail.');
              }
            });
          }}
        >
          {falha && <AvisoErro mensagem={falha} />}
          <Campo name="nome" rotulo="Nome" placeholder="Maria Silva" />
          <Campo name="email" type="email" rotulo="E-mail" placeholder="maria@empresa.com" />
          <SeletorSegmentado<PapelUsuario>
            name="papel-convite"
            rotulo="Papel"
            opcoes={PAPEIS_CONVITE.map((valor) => ({ valor, rotulo: ROTULO_PAPEL[valor] }))}
            valor={papel}
            aoMudar={trocarPapel}
            ajuda={descricaoPapel}
          />
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Acesso</span>
              {personalizado ? (
                <Selo tom="atencao" className="self-start">
                  Personalizado
                </Selo>
              ) : (
                <span className="text-muted-foreground text-xs">Padrão do papel</span>
              )}
            </div>
            <Botao
              type="button"
              variante="secundario"
              tamanho="sm"
              onClick={() => setPersonalizando(true)}
            >
              <SlidersHorizontal aria-hidden />
              Personalizar
            </Botao>
          </div>
          <Botao type="submit" carregando={enviando} disabled={bloqueado}>
            <Mail />
            Enviar convite
          </Botao>
        </form>
      </CartaoConteudo>

      {personalizando && (
        <PainelLateral
          titulo="Acesso do convidado"
          descricao="Vale assim que o convite for aceito."
          aoFechar={() => setPersonalizando(false)}
          rodape={
            <>
              <span />
              <Botao type="button" onClick={() => setPersonalizando(false)}>
                Pronto
              </Botao>
            </>
          }
        >
          <EditorAcessos
            catalogo={catalogo}
            papel={papel}
            papeisPermitidos={PAPEIS_CONVITE}
            aoTrocarPapel={trocarPapel}
            acessos={acessos}
            aoMudar={setAcessos}
          />
        </PainelLateral>
      )}
    </Cartao>
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
                {convite.email} · {ROTULO_PAPEL[convite.papel]}
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
