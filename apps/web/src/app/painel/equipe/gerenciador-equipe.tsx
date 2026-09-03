'use client';

import {
  GRUPOS_PERMISSOES,
  PERMISSOES_PADRAO_POR_PAPEL,
  type ConviteEquipe,
  type Funcionario,
  type PapelUsuario,
  type Permissao,
} from '@gestao/shared-types';
import { Mail, UserCheck, UserX } from 'lucide-react';
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

export function GerenciadorEquipe({
  funcionarios,
  convites,
}: {
  funcionarios: Funcionario[];
  convites: ConviteEquipe[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-3">
        {funcionarios.map((funcionario) => (
          <FormularioFuncionario key={funcionario.id} funcionario={funcionario} />
        ))}
      </div>
      <div className="flex flex-col gap-6">
        <FormularioConvite />
        {convites.length > 0 && <ConvitesPendentes convites={convites} />}
      </div>
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

function FormularioConvite() {
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
          <Mail className="size-4" />
          Convidar funcionário
        </CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo>
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
          <Botao type="submit" carregando={enviando}>
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
