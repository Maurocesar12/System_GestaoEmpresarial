'use client';

import {
  type CatalogoAcessos,
  type Funcionario,
  type MapaAcessos,
  type PapelUsuario,
} from '@gestao/shared-types';
import { ShieldCheck } from 'lucide-react';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { atualizarFuncionario, redefinirDoisFatores } from './acoes';
import { EditorAcessos } from './editor-acessos';

/** O painel lateral de edição de um funcionário: dados, comissão, acesso e 2FA. */

const TODOS_OS_PAPEIS: readonly PapelUsuario[] = ['admin', 'financeiro', 'atendente', 'tecnico'];

export function PainelFuncionario({
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
                ? 'Se a pessoa perdeu ou trocou de celular, redefina: no próximo login ela configura o app de novo.'
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
