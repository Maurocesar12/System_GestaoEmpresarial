'use client';

import { useState, useTransition } from 'react';
import {
  EditorMateriais,
  type LinhaMaterial,
  type MaterialDoCatalogo,
} from '@/components/painel/editor-materiais';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { salvarFichaTecnica } from '../acoes';

export function EditorFichaTecnica({
  servicoId,
  catalogo,
  iniciais,
}: {
  servicoId: string;
  catalogo: MaterialDoCatalogo[];
  iniciais: LinhaMaterial[];
}) {
  const [linhas, setLinhas] = useState(iniciais);
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();
  const { avisar } = useAvisos();

  return (
    <div className="flex flex-col gap-3">
      {erro && <AvisoErro mensagem={erro} />}

      <EditorMateriais
        catalogo={catalogo}
        linhas={linhas}
        aoMudar={setLinhas}
        desabilitado={salvando}
      />

      <Botao
        type="button"
        carregando={salvando}
        className="w-fit"
        onClick={() =>
          iniciar(async () => {
            setErro(undefined);
            const resultado = await salvarFichaTecnica(servicoId, linhas);
            setErro(resultado.erro);
            if (!resultado.erro) avisar('sucesso', 'Lista de materiais salva.');
          })
        }
      >
        Salvar lista de materiais
      </Botao>
    </div>
  );
}
