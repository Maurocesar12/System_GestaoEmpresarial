import type { Job } from 'bullmq';
import { ErroDeNotificacao } from '../../../../infra/notificacoes/notificador';
import type { PrismaService } from '../../../../infra/prisma/prisma.service';
import type { PayloadEnvioLembrete } from './envio.constantes';
import { LembretesProcessor } from './lembretes.processor';

const TENANT = '0198f1a0-0000-7000-8000-000000000001';
const LEMBRETE = '0198f1a0-0000-7000-8000-000000000002';

type LembreteCarregado = {
  status: 'pendente' | 'enviado' | 'falhou' | 'cancelado';
  canal: 'email' | 'whatsapp';
  cliente: { nome: string; email: string | null };
  tenant: { nome: string };
};

const LEMBRETE_PENDENTE: LembreteCarregado = {
  status: 'pendente',
  canal: 'email',
  cliente: { nome: 'Maria Souza', email: 'maria@exemplo.com' },
  tenant: { nome: 'Oficina do João' },
};

/**
 * Monta o processador com banco e notificador de mentira.
 *
 * O `comTenantExplicito` falso apenas repassa a transação simulada. O que
 * interessa nestes testes é a decisão de status — quem envia, quem desiste e
 * quem tenta de novo —, não o caminho até o PostgreSQL, que os testes de
 * integração cobrem.
 */
function criarAmbiente(lembrete: LembreteCarregado | null, erroDeEnvio?: Error) {
  const findUnique = jest.fn(() => Promise.resolve(lembrete));
  const update = jest.fn(() => Promise.resolve({}));
  const enviar = jest.fn(() => (erroDeEnvio ? Promise.reject(erroDeEnvio) : Promise.resolve()));

  const transacao = { lembreteFollowUp: { findUnique, update } };

  const comTenantExplicito = jest.fn(
    (_tenantId: string, operacao: (tx: unknown) => Promise<unknown>) => operacao(transacao),
  );

  // O `Notificador` declara só `enviar`, então o objeto abaixo já satisfaz o
  // contrato e dispensa conversão. O PrismaService tem superfície bem maior, e
  // aí a conversão é necessária para não precisar simular métodos que estes
  // testes nunca chamam.
  const processador = new LembretesProcessor({ comTenantExplicito } as unknown as PrismaService, {
    enviar,
  });

  return { processador, findUnique, update, enviar, comTenantExplicito };
}

function criarJob(data: Partial<PayloadEnvioLembrete> = {}): Job<PayloadEnvioLembrete> {
  return {
    id: 'job-1',
    data: { lembreteId: LEMBRETE, tenantId: TENANT, ...data },
  } as Job<PayloadEnvioLembrete>;
}

/** Extrai o `data` do `update` mais recente. */
function ultimaGravacao(update: jest.Mock): Record<string, unknown> {
  const chamada = update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };

  return chamada.data;
}

describe('LembretesProcessor', () => {
  it('envia o lembrete e o marca como enviado', async () => {
    const { processador, enviar, update } = criarAmbiente(LEMBRETE_PENDENTE);

    await processador.process(criarJob());

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(ultimaGravacao(update)).toMatchObject({ status: 'enviado', erro: null });
  });

  it('abre o escopo da empresa antes de qualquer acesso ao banco', async () => {
    // O worker roda fora de requisição: se o tenant do job não for aplicado,
    // não há isolamento nenhum protegendo a consulta.
    const { processador, comTenantExplicito } = criarAmbiente(LEMBRETE_PENDENTE);

    await processador.process(criarJob());

    expect(comTenantExplicito).toHaveBeenCalledWith(TENANT, expect.any(Function));
  });

  it('recusa job sem tenant em vez de rodar sem escopo', async () => {
    const { processador, findUnique } = criarAmbiente(LEMBRETE_PENDENTE);

    await expect(processador.process(criarJob({ tenantId: '' }))).rejects.toThrow(/tenantId/);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('não reenvia lembrete que já saiu do estado pendente', async () => {
    // Protege contra job repetido ou atrasado: se alguém cancelou pela tela
    // nesse meio-tempo, o envio não pode acontecer assim mesmo.
    const { processador, enviar, update } = criarAmbiente({
      ...LEMBRETE_PENDENTE,
      status: 'cancelado',
    });

    await processador.process(criarJob());

    expect(enviar).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('ignora lembrete que não existe mais', async () => {
    const { processador, enviar, update } = criarAmbiente(null);

    await processador.process(criarJob());

    expect(enviar).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('marca WhatsApp como falha explicando que o canal não está disponível', async () => {
    // Deixar pendente para sempre esconderia o problema do usuário; falhar com
    // motivo o traz para a tela.
    const { processador, enviar, update } = criarAmbiente({
      ...LEMBRETE_PENDENTE,
      canal: 'whatsapp',
    });

    await processador.process(criarJob());

    expect(enviar).not.toHaveBeenCalled();
    expect(ultimaGravacao(update)).toMatchObject({ status: 'falhou' });
    expect(String(ultimaGravacao(update).erro)).toContain('WhatsApp');
  });

  it('encerra como falhou quando o erro é permanente, sem pedir nova tentativa', async () => {
    const { processador, update } = criarAmbiente(
      LEMBRETE_PENDENTE,
      new ErroDeNotificacao('Destinatário sem endereço de e-mail cadastrado.', true),
    );

    await expect(processador.process(criarJob())).resolves.toBeUndefined();

    expect(ultimaGravacao(update)).toMatchObject({ status: 'falhou' });
  });

  it('mantém pendente e relança quando o erro é temporário', async () => {
    // Relançar é o que faz o BullMQ contar a tentativa e reagendar com espera.
    // O lembrete segue pendente para a varredura poder retomá-lo depois.
    const { processador, update } = criarAmbiente(
      LEMBRETE_PENDENTE,
      new ErroDeNotificacao('Servidor SMTP indisponível.', false),
    );

    await expect(processador.process(criarJob())).rejects.toThrow(/SMTP/);

    expect(ultimaGravacao(update)).toMatchObject({ status: 'pendente' });
  });

  it('registra o motivo da falha para o suporte conseguir explicar depois', async () => {
    const { processador, update } = criarAmbiente(
      LEMBRETE_PENDENTE,
      new ErroDeNotificacao('Caixa de entrada inexistente.', true),
    );

    await processador.process(criarJob());

    expect(ultimaGravacao(update).erro).toBe('Caixa de entrada inexistente.');
  });
});
