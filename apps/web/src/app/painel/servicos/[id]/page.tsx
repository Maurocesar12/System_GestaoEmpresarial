import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatarBRL,
  possuiPermissao,
  type FichaTecnica,
  type Material,
  type Paginado,
  type Servico,
} from '@gestao/shared-types';
import type { MaterialDoCatalogo } from '@/components/painel/editor-materiais';
import { apiComSessao, usuarioAtual } from '@/lib/api-servidor';
import { FormularioServico } from '../formulario-servico';
import { BotaoDesativar } from './botao-desativar';
import { EditorFichaTecnica } from './editor-ficha-tecnica';

export const metadata: Metadata = {
  title: 'Serviço',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaginaServico({ params }: Props) {
  const { id } = await params;
  const usuario = await usuarioAtual();
  const podeEditarLista =
    possuiPermissao(usuario, 'servicos.gerenciar') && possuiPermissao(usuario, 'estoque.visualizar');

  const [servico, ficha, materiais] = await Promise.all([
    apiComSessao<Servico>(`/servicos/${id}`),
    apiComSessao<FichaTecnica>(`/servicos/${id}/materiais`),
    podeEditarLista
      ? apiComSessao<Paginado<Material>>('/estoque/materiais?somenteAtivos=true&porPagina=100')
      : null,
  ]);

  const catalogo: MaterialDoCatalogo[] = (materiais?.dados ?? []).map((material) => ({
    id: material.id,
    nome: material.nome,
    unidade: material.unidade,
    custoMedio: material.custoMedio,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/painel/servicos"
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Serviços
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">{servico.nome}</h1>

        {!servico.ativo && (
          <p className="text-muted-foreground text-sm">
            Este serviço está desativado. Ele não aparece em orçamentos novos, mas continua no
            histórico.
          </p>
        )}
      </div>

      <FormularioServico servico={servico} />

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Materiais usados</h2>
          <p className="text-muted-foreground text-sm">
            A lista padrão de cada execução. Ao marcar um agendamento como executado, as
            quantidades podem ser ajustadas, o estoque baixa e o custo entra na margem do serviço.
          </p>
        </div>

        {podeEditarLista ? (
          <EditorFichaTecnica
            servicoId={servico.id}
            catalogo={[
              ...catalogo,
              ...ficha.itens
                .filter((item) => !catalogo.some((material) => material.id === item.materialId))
                .map((item) => ({
                  id: item.materialId,
                  nome: item.materialNome,
                  unidade: item.unidade,
                  custoMedio: item.custoMedio,
                })),
            ]}
            iniciais={ficha.itens.map((item) => ({
              materialId: item.materialId,
              quantidade: item.quantidade.replace('.', ','),
            }))}
          />
        ) : ficha.itens.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum material cadastrado.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {ficha.itens.map((item) => (
              <li key={item.materialId} className="flex justify-between gap-4 border-t py-2 first:border-t-0">
                <span>{item.materialNome}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.quantidade.replace('.', ',')} {item.unidade} ·{' '}
                  {formatarBRL(item.custoEstimado)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {servico.ativo && (
        <section className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Desativar serviço</h2>
            <p className="text-muted-foreground text-sm">
              Ele some das listas de orçamento, mas continua visível nos registros antigos. Nada é
              apagado — o relatório de margem dos meses anteriores permanece correto.
            </p>
          </div>

          <BotaoDesativar id={servico.id} />
        </section>
      )}
    </div>
  );
}
