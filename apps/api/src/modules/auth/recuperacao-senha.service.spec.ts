import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SenhaService } from './senha.service';
import { RecuperacaoSenhaService } from './recuperacao-senha.service';

describe('RecuperacaoSenhaService', () => {
  const secret = 'segredo-de-testes-com-mais-de-32-caracteres';
  const jwt = new JwtService({ secret });
  const config: ConfigService<Env, true> = new ConfigService({
    JWT_SECRET: secret,
    APP_URL: 'https://app.example.com',
  });
  let hash: string;
  const usuario = { id: 'usuario', tenantId: 'empresa', ativo: true };
  const enviar = jest.fn();
  const revogar = jest.fn();
  const atualizar = jest.fn();
  const buscar = jest.fn();
  const tx = { usuario: { findUnique: buscar, updateMany: atualizar }, refreshToken: { updateMany: revogar } };
  const prisma = {
    semTenant: (_motivo: string, callback: (db: typeof tx) => unknown) => callback(tx),
    comTenantExplicito: (_id: string, callback: (db: typeof tx) => unknown) => callback(tx),
  } as unknown as PrismaService;
  const senhas = { gerarHash: jest.fn(() => Promise.resolve('hash-novo')) } as unknown as SenhaService;
  const service = new RecuperacaoSenhaService(prisma, jwt, senhas, config, { modo: 'smtp', enviar });

  beforeEach(() => {
    jest.clearAllMocks();
    hash = 'hash-anterior';
    buscar.mockImplementation(() => Promise.resolve({ ...usuario, senhaHash: hash }));
    atualizar.mockImplementation(() => {
      hash = 'hash-novo';
      return Promise.resolve({ count: 1 });
    });
    enviar.mockResolvedValue(undefined);
  });

  async function emitir(): Promise<string> {
    await service.solicitar('pessoa@example.com');
    const corpo = enviar.mock.calls[0][0].corpo as string;
    const url = new URL(corpo.split('\n')[1]!);
    expect(url.search).toBe('');
    return new URLSearchParams(url.hash.slice(1)).get('token')!;
  }

  it('altera senha, revoga renovações e recusa reutilização', async () => {
    const token = await emitir();
    await service.redefinir(token, 'SenhaNova123!');
    expect(revogar).toHaveBeenCalledTimes(1);
    await expect(service.redefinir(token, 'OutraSenha123!')).rejects.toThrow('Link inválido');
  });

  it('recusa token expirado e token de acesso', async () => {
    const token = jwt.sign({ tipo: 'recuperacao' }, { expiresIn: -1, audience: 'recuperacao-senha' });
    await expect(service.redefinir(token, 'SenhaNova123!')).rejects.toThrow('Link inválido');
    await expect(service.redefinir(jwt.sign({ tipo: 'acesso' }), 'SenhaNova123!')).rejects.toThrow('Link inválido');
    expect(atualizar).not.toHaveBeenCalled();
  });

  it('não envia mensagem para conta inexistente', async () => {
    buscar.mockResolvedValue(null);
    await expect(service.solicitar('ausente@example.com')).resolves.toBeUndefined();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('recusa segunda alteração concorrente sem revogar sessões', async () => {
    const token = await emitir();
    atualizar.mockResolvedValue({ count: 0 });
    await expect(service.redefinir(token, 'SenhaNova123!')).rejects.toThrow('Link inválido');
    expect(revogar).not.toHaveBeenCalled();
  });
});
