import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CODIGOS_ERRO, type CadastroInput, type SessaoResponse } from '@gestao/shared-types';
import { uuidv7 } from '../../common/uuid';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SenhaService } from '../auth/senha.service';

/**
 * Etapas do funil criadas para toda empresa nova (arquitetura §7).
 *
 * A ordem importa: é ela que define a sequência do kanban. São só o ponto de
 * partida — cada empresa pode renomear, reordenar ou remover depois.
 *
 * Duas delas carregam um **marco**, que é o que permite ao sistema mover o
 * cliente sozinho: ao emitir um orçamento ele vai para a etapa marcada como
 * `orcamento_enviado`, e ao aprová-lo vai para a `fechado`. O marco viaja com
 * a etapa, então renomear "Fechado" para "Serviço vendido" não quebra nada.
 */
export const ETAPAS_FUNIL_PADRAO = [
  { nome: 'Novo contato', marco: null },
  { nome: 'Diagnóstico', marco: null },
  { nome: 'Orçamento enviado', marco: 'orcamento_enviado' },
  { nome: 'Follow-up', marco: null },
  { nome: 'Fechado', marco: 'fechado' },
  { nome: 'Serviço executado', marco: null },
  { nome: 'Pós-venda', marco: null },
] as const;

/**
 * Cadastro self-service.
 *
 * Cria a empresa, o primeiro usuário (sempre `admin`, pois alguém precisa poder
 * convidar os demais) e as etapas do funil. Ao final, já devolve a sessão
 * pronta: obrigar a pessoa a fazer login logo depois de escolher a senha seria
 * atrito sem propósito.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async cadastrar(dados: CadastroInput): Promise<SessaoResponse> {
    const plano = await this.buscarPlanoPadrao();

    // O hash é calculado antes da transação de propósito: o Argon2id leva
    // centenas de milissegundos, e segurar uma transação de banco aberta
    // durante esse tempo prende uma conexão do pool à toa.
    const senhaHash = await this.senhas.gerarHash(dados.senha);

    await this.garantirEmailDisponivel(dados.email);

    const trialDias = this.config.get('ONBOARDING_TRIAL_DIAS', { infer: true });

    // Tudo numa transação só: se qualquer passo falhar, nada é criado. Sem
    // isso, uma falha no meio deixaria uma empresa sem usuário — cadastrada,
    // inacessível e impossível de recuperar pela própria pessoa.
    const criado = await this.prisma.criarNovoTenant(
      {
        nome: dados.nomeEmpresa,
        plano: { connect: { id: plano.id } },
        status: 'trial',
        trialTerminaEm: new Date(Date.now() + trialDias * 24 * 60 * 60 * 1000),
      },
      async (tx, tenantId) => {
        const usuario = await tx.usuario.create({
          data: {
            id: uuidv7(),
            tenantId,
            nome: dados.nomeResponsavel,
            email: dados.email,
            senhaHash,
            // O primeiro usuário é sempre admin: é ele quem vai convidar o
            // resto da equipe e configurar a empresa.
            papel: 'admin',
          },
        });

        await tx.etapaFunil.createMany({
          data: ETAPAS_FUNIL_PADRAO.map((etapa, indice) => ({
            id: uuidv7(),
            tenantId,
            nome: etapa.nome,
            ordem: indice + 1,
            marco: etapa.marco,
          })),
        });

        return { usuario, tenantId };
      },
    );

    return this.auth.montarSessao({
      id: criado.usuario.id,
      nome: criado.usuario.nome,
      email: criado.usuario.email,
      papel: criado.usuario.papel,
      tenantId: criado.tenantId,
      nomeEmpresa: dados.nomeEmpresa,
    });
  }

  /**
   * Recusa o cadastro se o e-mail já tem conta.
   *
   * A checagem é feita fora de escopo de tenant porque o e-mail precisa ser
   * único no sistema inteiro para o login funcionar: se duas empresas tivessem
   * o mesmo e-mail cadastrado, não haveria como saber em qual delas autenticar.
   */
  private async garantirEmailDisponivel(email: string): Promise<void> {
    const existente = await this.prisma.semTenant(
      'verificar e-mail já cadastrado antes de criar a empresa',
      (db) => db.usuario.findFirst({ where: { email }, select: { id: true } }),
    );

    if (existente) {
      throw new ConflictException({
        codigo: CODIGOS_ERRO.CONFLITO,
        mensagem: 'Este e-mail já tem cadastro. Faça login ou use outro e-mail.',
      });
    }
  }

  private async buscarPlanoPadrao() {
    const slug = this.config.get('ONBOARDING_PLANO_PADRAO', { infer: true });

    const plano = await this.prisma.semTenant('ler o catálogo de planos do produto', (db) =>
      db.plano.findUnique({ where: { slug } }),
    );

    if (!plano) {
      // Erro de configuração do servidor, não do usuário: alguém apontou para
      // um plano que não existe, ou o seed não rodou.
      //
      // O status precisa ser 500, e não 404: um "não encontrado" aqui parece
      // rota inexistente e manda quem for investigar para o lado errado — foi
      // exatamente o que aconteceu quando este erro apareceu pela primeira vez.
      throw new InternalServerErrorException({
        codigo: CODIGOS_ERRO.ERRO_INTERNO,
        mensagem: `Plano padrão "${slug}" não encontrado. Rode "pnpm --filter @gestao/api db:seed" ou ajuste ONBOARDING_PLANO_PADRAO.`,
      });
    }

    return plano;
  }
}
