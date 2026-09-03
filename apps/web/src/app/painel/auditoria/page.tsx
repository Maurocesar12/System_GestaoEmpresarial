import type { Metadata } from 'next';
import { ScrollText } from 'lucide-react';
import type { RegistroAuditoria } from '@gestao/shared-types';
import { CabecalhoPagina } from '@/components/ui/cabecalho-pagina';
import { Cartao } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  TabelaCabecalho,
  TabelaCelula,
  TabelaColuna,
  TabelaCorpo,
  TabelaLinha,
  TabelaRolavel,
} from '@/components/ui/tabela';
import { apiComSessao } from '@/lib/api-servidor';

export const metadata: Metadata = { title: 'Auditoria' };

const ROTULO_ENTIDADE: Record<string, string> = {
  funcionario: 'Funcionário',
  convite: 'Convite',
  cliente: 'Cliente',
  lancamento: 'Lançamento',
  funil: 'Funil',
};

export default async function PaginaAuditoria() {
  const registros = await apiComSessao<RegistroAuditoria[]>('/auditoria');
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Auditoria"
        descricao="Últimas 200 alterações realizadas na empresa."
      />
      {registros.length === 0 ? (
        <EstadoVazio
          icone={ScrollText}
          titulo="Nenhuma alteração registrada"
          descricao="As próximas ações importantes aparecerão aqui."
        />
      ) : (
        <Cartao>
          <TabelaRolavel>
            <TabelaCabecalho>
              <TabelaColuna>Data</TabelaColuna>
              <TabelaColuna>Responsável</TabelaColuna>
              <TabelaColuna>Ação</TabelaColuna>
              <TabelaColuna>Registro</TabelaColuna>
            </TabelaCabecalho>
            <TabelaCorpo>
              {registros.map((registro) => (
                <TabelaLinha key={registro.id}>
                  <TabelaCelula suave className="whitespace-nowrap">
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(registro.criadoEm))}
                  </TabelaCelula>
                  <TabelaCelula>{registro.usuarioNome}</TabelaCelula>
                  <TabelaCelula className="capitalize">{registro.acao}</TabelaCelula>
                  <TabelaCelula>
                    {ROTULO_ENTIDADE[registro.entidade] ?? registro.entidade}
                  </TabelaCelula>
                </TabelaLinha>
              ))}
            </TabelaCorpo>
          </TabelaRolavel>
        </Cartao>
      )}
    </div>
  );
}
