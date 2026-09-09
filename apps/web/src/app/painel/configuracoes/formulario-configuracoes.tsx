'use client';
import {
  type CampoPersonalizado,
  type ConfiguracoesEmpresa,
  type Etiqueta,
  type TipoCampoPersonalizado,
} from '@gestao/shared-types';
import { Check, MailCheck, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { useAvisos } from '@/components/ui/avisos';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Selecao } from '@/components/ui/selecao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { PALETA_ETIQUETAS, estilosEtiqueta } from '@/lib/etiquetas';
import { salvarConfiguracoes, testarEmail } from './acoes';

type CampoEditavel = Omit<CampoPersonalizado, 'id'> & { id?: string };
type EtiquetaEditavel = Omit<Etiqueta, 'id'> & { id?: string };

export function FormularioConfiguracoes({ iniciais }: { iniciais: ConfiguracoesEmpresa }) {
  const [campos, setCampos] = useState<CampoEditavel[]>(iniciais.campos);
  const [etiquetas, setEtiquetas] = useState<EtiquetaEditavel[]>(iniciais.etiquetas);
  const [falha, setFalha] = useState<string>();
  const [emailTeste, setEmailTeste] = useState(iniciais.email ?? '');
  const [salvando, iniciar] = useTransition();
  const [testandoEmail, iniciarTesteEmail] = useTransition();
  const { avisar } = useAvisos();
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        iniciar(async () => {
          const resultado = await salvarConfiguracoes({
            nome: String(form.get('nome')),
            cnpj: String(form.get('cnpj')),
            email: String(form.get('email')),
            telefone: String(form.get('telefone')),
            campos,
            etiquetas,
          });
          setFalha(resultado.erro);
          if (resultado.configuracoes) {
            // Guarda os IDs que o banco gerou para itens novos. Assim, um
            // segundo salvamento atualiza os mesmos itens em vez de duplicá-los.
            setCampos(resultado.configuracoes.campos);
            setEtiquetas(resultado.configuracoes.etiquetas);
            avisar('sucesso', 'Configurações salvas.');
          }
        });
      }}
    >
      {falha && <AvisoErro mensagem={falha} />}
      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Dados da empresa</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-4 md:grid-cols-2">
          <Campo name="nome" rotulo="Nome da empresa" defaultValue={iniciais.nome} />
          <Campo name="cnpj" rotulo="CNPJ" defaultValue={iniciais.cnpj ?? ''} />
          <Campo name="email" type="email" rotulo="E-mail" defaultValue={iniciais.email ?? ''} />
          <Campo name="telefone" rotulo="Telefone" defaultValue={iniciais.telefone ?? ''} />
        </CartaoConteudo>
      </Cartao>
      <Cartao>
        <CartaoCabecalho>
          <div>
            <CartaoTitulo>Teste de envio de e-mail</CartaoTitulo>
            <p className="text-muted-foreground mt-1 text-xs">
              Confirme se convites e lembretes conseguem chegar ao destinatário.
            </p>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <Campo
            className="sm:min-w-80"
            type="email"
            rotulo="Destinatário do teste"
            value={emailTeste}
            onChange={(evento) => setEmailTeste(evento.target.value)}
          />
          <Botao
            type="button"
            variante="secundario"
            carregando={testandoEmail}
            onClick={() =>
              iniciarTesteEmail(async () => {
                setFalha(undefined);
                const resultado = await testarEmail(emailTeste);
                setFalha(resultado.erro);
                if (resultado.modo === 'smtp') {
                  avisar('sucesso', 'E-mail de teste enviado. Confira a caixa de entrada.');
                }
                if (resultado.modo === 'simulado') {
                  avisar('atencao', 'SMTP ainda não configurado. O teste apareceu apenas no log.');
                }
              })
            }
          >
            <MailCheck />
            Enviar teste
          </Botao>
        </CartaoConteudo>
      </Cartao>
      <Cartao>
        <CartaoCabecalho>
          <div>
            <CartaoTitulo>Campos personalizados de clientes</CartaoTitulo>
            <p className="text-muted-foreground mt-1 text-xs">
              Crie informações próprias do seu negócio, como tamanho, contrato ou região.
            </p>
          </div>
          <Botao
            type="button"
            variante="secundario"
            tamanho="sm"
            onClick={() =>
              setCampos([...campos, { nome: '', tipo: 'texto', obrigatorio: false, opcoes: [] }])
            }
          >
            <Plus />
            Campo
          </Botao>
        </CartaoCabecalho>
        <CartaoConteudo className="flex flex-col gap-3">
          {campos.map((campo, indice) => (
            <div
              key={campo.id ?? indice}
              className="grid items-end gap-3 rounded-md border p-3 md:grid-cols-[1fr_10rem_1fr_auto]"
            >
              <Campo
                rotulo="Nome"
                value={campo.nome}
                onChange={(e) => alterarCampo(indice, { nome: e.target.value })}
              />
              <Selecao
                rotulo="Tipo"
                value={campo.tipo}
                onChange={(e) =>
                  alterarCampo(indice, { tipo: e.target.value as TipoCampoPersonalizado })
                }
              >
                {['texto', 'numero', 'data', 'selecao'].map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </Selecao>
              <Campo
                rotulo="Opções"
                ajuda="Separadas por vírgula; somente para seleção."
                disabled={campo.tipo !== 'selecao'}
                value={campo.opcoes.join(', ')}
                onChange={(e) =>
                  alterarCampo(indice, {
                    opcoes: e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
              <Botao
                type="button"
                variante="sutil"
                tamanho="icone"
                aria-label="Remover campo"
                onClick={() => setCampos(campos.filter((_, i) => i !== indice))}
              >
                <Trash2 />
              </Botao>
              <label className="flex items-center gap-2 text-xs md:col-span-4">
                <input
                  type="checkbox"
                  checked={campo.obrigatorio}
                  onChange={(e) => alterarCampo(indice, { obrigatorio: e.target.checked })}
                />
                Preenchimento obrigatório
              </label>
            </div>
          ))}
          {!campos.length && (
            <p className="text-muted-foreground text-sm">Nenhum campo personalizado.</p>
          )}
        </CartaoConteudo>
      </Cartao>
      <Cartao>
        <CartaoCabecalho>
          <div>
            <CartaoTitulo>Etiquetas de clientes</CartaoTitulo>
            <p className="text-muted-foreground mt-1 text-xs">
              Use cores para identificar grupos importantes.
            </p>
          </div>
          <Botao
            type="button"
            variante="secundario"
            tamanho="sm"
            onClick={() =>
              setEtiquetas([
                ...etiquetas,
                {
                  nome: '',
                  cor: PALETA_ETIQUETAS[etiquetas.length % PALETA_ETIQUETAS.length]!.cor,
                },
              ])
            }
          >
            <Plus />
            Etiqueta
          </Botao>
        </CartaoCabecalho>
        <CartaoConteudo className="flex flex-col gap-3">
          {etiquetas.map((etiqueta, indice) => (
            <div
              key={etiqueta.id ?? indice}
              className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="flex flex-col gap-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Cor da etiqueta</span>
                  <span
                    className="max-w-44 truncate rounded-[4px] border px-2.5 py-1 text-xs font-semibold"
                    style={estilosEtiqueta(etiqueta.cor)}
                  >
                    {etiqueta.nome.trim() || 'Nova etiqueta'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {PALETA_ETIQUETAS.map((opcao) => {
                    const selecionada = etiqueta.cor.toUpperCase() === opcao.cor;

                    return (
                      <button
                        key={opcao.cor}
                        type="button"
                        aria-label={`Usar ${opcao.nome}`}
                        aria-pressed={selecionada}
                        title={opcao.nome}
                        onClick={() => alterarEtiqueta(indice, { cor: opcao.cor })}
                        className="flex size-8 items-center justify-center rounded-[5px] border border-black/10 shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        style={{ backgroundColor: opcao.cor }}
                      >
                        {selecionada && (
                          <Check aria-hidden className="size-4" style={{ color: estilosEtiqueta(opcao.cor).color }} />
                        )}
                      </button>
                    );
                  })}

                  <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-[5px] border shadow-sm" title="Cor personalizada">
                    <span className="sr-only">Escolher cor personalizada</span>
                    <input
                      type="color"
                      className="absolute inset-[-8px] size-12 cursor-pointer border-0 p-0"
                      value={etiqueta.cor}
                      onChange={(evento) => alterarEtiqueta(indice, { cor: evento.target.value })}
                    />
                  </label>
                </div>
              </div>

              <Campo
                rotulo="Nome"
                value={etiqueta.nome}
                onChange={(evento) => alterarEtiqueta(indice, { nome: evento.target.value })}
              />

              <Botao
                type="button"
                variante="sutil"
                tamanho="icone"
                aria-label="Remover etiqueta"
                onClick={() => setEtiquetas(etiquetas.filter((_, item) => item !== indice))}
              >
                <Trash2 />
              </Botao>
            </div>
          ))}
          {!etiquetas.length && (
            <p className="text-muted-foreground text-sm">Nenhuma etiqueta cadastrada.</p>
          )}
        </CartaoConteudo>
      </Cartao>
      <Botao type="submit" carregando={salvando} className="self-start">
        Salvar configurações
      </Botao>
    </form>
  );
  function alterarCampo(indice: number, mudanca: Partial<CampoEditavel>) {
    setCampos(campos.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));
  }
  function alterarEtiqueta(indice: number, mudanca: Partial<EtiquetaEditavel>) {
    setEtiquetas(etiquetas.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));
  }
}
