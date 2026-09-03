import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CODIGOS_ERRO,
  type ConfiguracoesEmpresa,
  type ConfiguracoesEmpresaInput,
  type TesteEmailInput,
  type TesteEmailResponse,
} from '@gestao/shared-types';
import { uuidv7 } from '../../../common/uuid';
import { ErroDeNotificacao, Notificador } from '../../../infra/notificacoes/notificador';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { tenantAtual } from '../../../infra/tenant/tenant-context';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class ConfiguracoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificador: Notificador,
  ) {}

  async buscar(): Promise<ConfiguracoesEmpresa> {
    const tenant = await this.prisma.comTenant((tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantAtual() },
        include: {
          camposPersonalizados: { orderBy: { ordem: 'asc' } },
          etiquetas: { orderBy: { nome: 'asc' } },
        },
      }),
    );
    return this.paraResposta(tenant);
  }

  async salvar(dados: ConfiguracoesEmpresaInput): Promise<ConfiguracoesEmpresa> {
    const tenant = await this.prisma.comTenant(async (tx) => {
      const anterior = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantAtual() },
        include: { camposPersonalizados: true, etiquetas: true },
      });
      const idsCampos = dados.campos.flatMap((item) => (item.id ? [item.id] : []));
      const idsEtiquetas = dados.etiquetas.flatMap((item) => (item.id ? [item.id] : []));
      this.garantirIdsDaEmpresa(
        idsCampos,
        anterior.camposPersonalizados.map((item) => item.id),
        'campo personalizado',
      );
      this.garantirIdsDaEmpresa(
        idsEtiquetas,
        anterior.etiquetas.map((item) => item.id),
        'etiqueta',
      );
      await tx.campoPersonalizado.deleteMany({ where: { id: { notIn: idsCampos } } });
      await tx.etiqueta.deleteMany({ where: { id: { notIn: idsEtiquetas } } });

      for (const [ordem, campo] of dados.campos.entries()) {
        const data = {
          nome: campo.nome,
          tipo: campo.tipo,
          obrigatorio: campo.obrigatorio,
          opcoes: campo.tipo === 'selecao' ? campo.opcoes : [],
          ordem,
        };
        if (campo.id) await tx.campoPersonalizado.update({ where: { id: campo.id }, data });
        else
          await tx.campoPersonalizado.create({
            data: { id: uuidv7(), tenantId: tenantAtual(), ...data },
          });
      }
      for (const etiqueta of dados.etiquetas) {
        const data = { nome: etiqueta.nome, cor: etiqueta.cor };
        if (etiqueta.id) await tx.etiqueta.update({ where: { id: etiqueta.id }, data });
        else await tx.etiqueta.create({ data: { id: uuidv7(), tenantId: tenantAtual(), ...data } });
      }
      await tx.tenant.update({
        where: { id: tenantAtual() },
        data: { nome: dados.nome, cnpj: dados.cnpj, email: dados.email, telefone: dados.telefone },
      });
      const atualizado = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantAtual() },
        include: {
          camposPersonalizados: { orderBy: { ordem: 'asc' } },
          etiquetas: { orderBy: { nome: 'asc' } },
        },
      });
      await this.auditoria.registrar(tx, {
        entidade: 'empresa',
        entidadeId: tenantAtual(),
        acao: 'alterou',
        antes: this.paraResposta(anterior),
        depois: this.paraResposta(atualizado),
      });
      return atualizado;
    });
    return this.paraResposta(tenant);
  }

  async testarEmail(dados: TesteEmailInput): Promise<TesteEmailResponse> {
    const empresa = await this.prisma.comTenant((tx) =>
      tx.tenant.findUniqueOrThrow({ where: { id: tenantAtual() }, select: { nome: true } }),
    );

    try {
      await this.notificador.enviar({
        destinatario: dados.email,
        assunto: `Teste de e-mail — ${empresa.nome}`,
        corpo:
          `Este é um teste de envio do sistema ${empresa.nome}.\n\n` +
          'Se você recebeu esta mensagem, a configuração de e-mail está funcionando.',
      });
    } catch (erro) {
      if (erro instanceof ErroDeNotificacao) {
        throw new BadRequestException({
          codigo: CODIGOS_ERRO.VALIDACAO,
          mensagem:
            'Não foi possível enviar o e-mail. Confira o destinatário, SMTP_URL, ' +
            'EMAIL_REMETENTE e a verificação do domínio.',
        });
      }

      throw erro;
    }

    return { modo: this.notificador.modo ?? 'simulado' };
  }

  private paraResposta(tenant: {
    nome: string;
    cnpj: string | null;
    email: string | null;
    telefone: string | null;
    camposPersonalizados: Array<{
      id: string;
      nome: string;
      tipo: 'texto' | 'numero' | 'data' | 'selecao';
      obrigatorio: boolean;
      opcoes: string[];
    }>;
    etiquetas: Array<{ id: string; nome: string; cor: string }>;
  }): ConfiguracoesEmpresa {
    return {
      nome: tenant.nome,
      cnpj: tenant.cnpj,
      email: tenant.email,
      telefone: tenant.telefone,
      campos: tenant.camposPersonalizados.map((item) => ({
        id: item.id,
        nome: item.nome,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        opcoes: item.opcoes,
      })),
      etiquetas: tenant.etiquetas.map((item) => ({ id: item.id, nome: item.nome, cor: item.cor })),
    };
  }

  private garantirIdsDaEmpresa(recebidos: string[], existentes: string[], entidade: string): void {
    const permitidos = new Set(existentes);
    if (recebidos.some((id) => !permitidos.has(id))) {
      throw new BadRequestException({
        codigo: CODIGOS_ERRO.VALIDACAO,
        mensagem: `Uma ${entidade} não existe ou pertence a outra empresa.`,
      });
    }
  }
}
