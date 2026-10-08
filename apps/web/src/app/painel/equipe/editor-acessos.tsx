'use client';

import type {
  AcessoArea,
  AreaDeAcesso,
  CatalogoAcessos,
  MapaAcessos,
  NivelAcesso,
  PapelUsuario,
  Permissao,
} from '@gestao/shared-types';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { SeletorSegmentado } from '@/components/ui/seletor-segmentado';
import { Selo } from '@/components/ui/selo';
import { cn } from '@/lib/utils';

/**
 * Escolha do papel e do nível de acesso em cada área.
 *
 * A tela só exibe e devolve a escolha: os níveis, o que cada um libera e o
 * padrão de cada papel vêm prontos da API no `catalogo`, e é a API que
 * converte a escolha em permissões ao salvar.
 */
export function EditorAcessos({
  catalogo,
  papel,
  papeisPermitidos,
  aoTrocarPapel,
  acessos,
  aoMudar,
}: {
  catalogo: CatalogoAcessos;
  papel: PapelUsuario;
  papeisPermitidos: readonly PapelUsuario[];
  /** Trocar o papel recomeça do padrão dele — quem chama redefine os acessos. */
  aoTrocarPapel: (papel: PapelUsuario) => void;
  acessos: MapaAcessos;
  aoMudar: (acessos: MapaAcessos) => void;
}) {
  const padrao = catalogo.padraoPorPapel[papel];
  const personalizado = !mesmosAcessos(acessos, padrao);
  const papeis = catalogo.papeis.filter((item) => papeisPermitidos.includes(item.papel));

  function mudarArea(area: AreaDeAcesso, acesso: AcessoArea) {
    aoMudar({ ...acessos, [area.id]: acesso });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Papel</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {papeis.map((item) => {
            const escolhido = item.papel === papel;
            return (
              <label
                key={item.papel}
                className={cn(
                  'flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors',
                  'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-1',
                  escolhido
                    ? 'border-primary bg-primary/5 shadow-(--sombra-sutil)'
                    : 'hover:bg-accent/60',
                )}
              >
                <input
                  type="radio"
                  name="papel"
                  value={item.papel}
                  checked={escolhido}
                  onChange={() => aoTrocarPapel(item.papel)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-4 place-items-center rounded-full border',
                      escolhido ? 'border-primary' : 'border-muted-foreground/40',
                    )}
                  >
                    {escolhido && <span className="bg-primary size-2 rounded-full" />}
                  </span>
                  {item.rotulo}
                </span>
                <span className="text-muted-foreground pl-6 text-xs leading-relaxed">
                  {item.descricao}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          Trocar o papel recomeça do acesso padrão dele.
        </p>
      </fieldset>

      {papel === 'admin' ? (
        <div className="bg-info-suave border-info/25 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <ShieldCheck aria-hidden className="text-info mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">Administrador tem acesso total.</span>{' '}
            <span className="text-muted-foreground">
              Vê e altera tudo, inclusive equipe, plano e cobrança. Para limitar o acesso, escolha
              outro papel.
            </span>
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="titulo-acesso-areas">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 id="titulo-acesso-areas" className="text-sm font-medium">
                Acesso por área
              </h3>
              <p className="text-muted-foreground text-xs">
                Acessa {areasComAcesso(catalogo.areas, acessos)} de {catalogo.areas.length} áreas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {personalizado ? (
                <>
                  <Selo tom="atencao">Personalizado</Selo>
                  <Botao
                    type="button"
                    variante="sutil"
                    tamanho="sm"
                    onClick={() => aoMudar(padrao)}
                  >
                    <RotateCcw aria-hidden />
                    Voltar ao padrão
                  </Botao>
                </>
              ) : (
                <Selo tom="neutro">Padrão do papel</Selo>
              )}
            </div>
          </div>

          <ul className="divide-y rounded-lg border">
            {catalogo.areas.map((area) => (
              <li key={area.id} className="p-4">
                <EditorArea
                  area={area}
                  acesso={acessos[area.id]}
                  aoMudar={(acesso) => mudarArea(area, acesso)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EditorArea({
  area,
  acesso,
  aoMudar,
}: {
  area: AreaDeAcesso;
  acesso: AcessoArea;
  aoMudar: (acesso: AcessoArea) => void;
}) {
  const soExtras = area.niveis.length === 0;
  const nivelAtual = area.niveis.find((item) => item.nivel === acesso.nivel);
  // Numa área com níveis, extra sem nível não vale nada — a API descarta.
  const extrasLiberados = soExtras || nivelAtual !== undefined;

  function alternarExtra(codigo: Permissao, ligado: boolean) {
    const extras = ligado
      ? [...acesso.extras, codigo]
      : acesso.extras.filter((item) => item !== codigo);
    aoMudar({ ...acesso, extras });
  }

  return (
    <div className="flex flex-col gap-3">
      {soExtras ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{area.titulo}</span>
          <span className="text-muted-foreground text-xs">{area.descricao}</span>
        </div>
      ) : (
        <SeletorSegmentado<NivelAcesso>
          name={`nivel-${area.id}`}
          rotulo={area.titulo}
          opcoes={[
            { valor: 'nenhum', rotulo: 'Sem acesso' },
            ...area.niveis.map((item) => ({ valor: item.nivel, rotulo: item.rotulo })),
          ]}
          valor={acesso.nivel}
          // Sem nível, os extras somem junto: voltar a dar acesso não deve
          // religar sozinho o que a pessoa já tinha desmarcado em silêncio.
          aoMudar={(nivel) => aoMudar({ nivel, extras: nivel === 'nenhum' ? [] : acesso.extras })}
          ajuda={nivelAtual?.descricao ?? `${area.descricao} Sem acesso, não vê nada desta área.`}
        />
      )}

      {area.extras.length > 0 && (
        <fieldset
          disabled={!extrasLiberados}
          className={cn('flex flex-col gap-2', !extrasLiberados && 'opacity-60')}
        >
          {!soExtras && (
            <legend className="text-muted-foreground mb-1.5 text-xs font-medium">
              {extrasLiberados ? 'Também pode' : 'Escolha um nível para liberar'}
            </legend>
          )}
          {area.extras.map((extra) => (
            <label
              key={extra.codigo}
              className="flex cursor-pointer items-start gap-2.5 text-sm has-[:disabled]:cursor-not-allowed"
            >
              <input
                type="checkbox"
                checked={acesso.extras.includes(extra.codigo)}
                onChange={(evento) => alternarExtra(extra.codigo, evento.target.checked)}
                className="accent-primary mt-0.5 size-4 shrink-0"
              />
              {extra.rotulo}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** Só para o selo "Personalizado" enquanto edita; o que vale é o que a API grava. */
export function mesmosAcessos(a: MapaAcessos, b: MapaAcessos) {
  return (Object.keys(b) as Array<keyof MapaAcessos>).every((area) => {
    const extrasA = new Set(a[area].extras);
    return (
      a[area].nivel === b[area].nivel &&
      extrasA.size === b[area].extras.length &&
      b[area].extras.every((extra) => extrasA.has(extra))
    );
  });
}

function areasComAcesso(areas: readonly AreaDeAcesso[], acessos: MapaAcessos) {
  return areas.filter(
    (area) => acessos[area.id].nivel !== 'nenhum' || acessos[area.id].extras.length > 0,
  ).length;
}
