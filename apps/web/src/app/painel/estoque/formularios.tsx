'use client';

import {
  ROTULO_UNIDADE,
  UNIDADES_MATERIAL,
  type Material,
} from '@gestao/shared-types';
import { useRef, useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Selecao } from '@/components/ui/selecao';
import type { ResultadoAcao } from '@/lib/acoes';
import { registrarAjuste, registrarEntrada, salvarMaterial } from './acoes';

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? '');
const primeiro = (falha: ResultadoAcao | undefined, campo: string) => falha?.campos?.[campo]?.[0];

export function FormularioMaterial({ material }: { material?: Material }) {
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [salvando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        const form = new FormData(evento.currentTarget);
        setFalha(undefined);

        iniciar(async () => {
          const resultado = await salvarMaterial(material?.id ?? null, {
            nome: texto(form, 'nome'),
            unidade: texto(form, 'unidade'),
            estoqueMinimo: texto(form, 'estoqueMinimo'),
            ativo: form.get('ativo') === 'on',
          });
          setFalha(resultado);
          if (!resultado.erro) avisar('sucesso', 'Material salvo.');
        });
      }}
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} />}

      <Campo
        name="nome"
        rotulo="Nome"
        placeholder="Cabo flexível 2,5 mm"
        defaultValue={material?.nome}
        erro={primeiro(falha, 'nome')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao name="unidade" rotulo="Unidade" defaultValue={material?.unidade ?? 'un'}>
          {UNIDADES_MATERIAL.map((unidade) => (
            <option key={unidade} value={unidade}>
              {ROTULO_UNIDADE[unidade]} ({unidade})
            </option>
          ))}
        </Selecao>

        <Campo
          name="estoqueMinimo"
          rotulo="Estoque mínimo"
          inputMode="decimal"
          ajuda="Abaixo disto o material aparece para repor."
          defaultValue={material?.estoqueMinimo?.replace('.', ',') ?? ''}
          erro={primeiro(falha, 'estoqueMinimo')}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="ativo" type="checkbox" defaultChecked={material?.ativo ?? true} />
        Material ativo
      </label>

      <Botao type="submit" carregando={salvando} className="w-fit">
        {material ? 'Salvar alterações' : 'Cadastrar material'}
      </Botao>
    </form>
  );
}

export function FormularioEntrada({ material }: { material: Material }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [salvando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        const form = new FormData(evento.currentTarget);
        setFalha(undefined);

        iniciar(async () => {
          const resultado = await registrarEntrada(material.id, {
            quantidade: texto(form, 'quantidade'),
            custoUnitario: texto(form, 'custoUnitario'),
            data: texto(form, 'data'),
            observacao: texto(form, 'observacao'),
          });
          setFalha(resultado);
          if (!resultado.erro) {
            formulario.current?.reset();
            avisar('sucesso', 'Entrada registrada.');
          }
        });
      }}
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          name="quantidade"
          rotulo={`Quantidade (${material.unidade})`}
          inputMode="decimal"
          erro={primeiro(falha, 'quantidade')}
        />
        <Campo
          name="custoUnitario"
          rotulo="Custo por unidade"
          inputMode="decimal"
          placeholder="12,50"
          erro={primeiro(falha, 'custoUnitario')}
        />
        <Campo name="data" rotulo="Data" type="date" ajuda="Vazio usa hoje." />
        <Campo name="observacao" rotulo="Observação" placeholder="Nota fiscal, fornecedor" />
      </div>

      <p className="text-muted-foreground text-xs">
        A entrada atualiza o saldo e o custo médio. Registre o pagamento da compra no financeiro
        sem vincular a um serviço: o custo chega à margem quando o material é usado.
      </p>

      <Botao type="submit" carregando={salvando} className="w-fit">
        Registrar entrada
      </Botao>
    </form>
  );
}

export function FormularioAjuste({ material }: { material: Material }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [falha, setFalha] = useState<ResultadoAcao>();
  const [salvando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  return (
    <form
      ref={formulario}
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        const form = new FormData(evento.currentTarget);
        setFalha(undefined);

        iniciar(async () => {
          const resultado = await registrarAjuste(material.id, {
            quantidadeContada: texto(form, 'quantidadeContada'),
            observacao: texto(form, 'observacao'),
          });
          setFalha(resultado);
          if (!resultado.erro) {
            formulario.current?.reset();
            avisar('sucesso', 'Estoque ajustado.');
          }
        });
      }}
    >
      {falha?.erro && <AvisoErro mensagem={falha.erro} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          name="quantidadeContada"
          rotulo={`Quantidade contada (${material.unidade})`}
          inputMode="decimal"
          ajuda={`Saldo no sistema: ${material.quantidade.replace('.', ',')}`}
          erro={primeiro(falha, 'quantidadeContada')}
        />
        <Campo
          name="observacao"
          rotulo="Motivo"
          placeholder="Inventário, perda, quebra"
          erro={primeiro(falha, 'observacao')}
        />
      </div>

      <Botao type="submit" variante="secundario" carregando={salvando} className="w-fit">
        Ajustar pela contagem
      </Botao>
    </form>
  );
}
