'use client';

import {
  ROTULO_PAPEL,
  type CatalogoAcessos,
  type ConviteEquipe,
  type EquipeResponse,
  type MapaAcessos,
  type PapelUsuario,
} from '@gestao/shared-types';
import { Mail, SlidersHorizontal, UserPlus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { SeletorSegmentado } from '@/components/ui/seletor-segmentado';
import { Selo } from '@/components/ui/selo';
import { cancelarConvite, convidarFuncionario } from './acoes';
import { EditorAcessos, mesmosAcessos } from './editor-acessos';

/** Convidar funcionário e acompanhar os convites pendentes. */

/** Convite nunca cria administrador — a API recusa; a tela nem oferece. */
const PAPEIS_CONVITE = ['atendente', 'financeiro', 'tecnico'] as const;

export function FormularioConvite({
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

export function ConvitesPendentes({ convites }: { convites: ConviteEquipe[] }) {
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
