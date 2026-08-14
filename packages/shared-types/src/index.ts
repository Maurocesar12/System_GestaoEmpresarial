// Contrato compartilhado entre a API (NestJS) e o frontend (Next.js).
// Fonte única de verdade para enums de domínio, schemas de validação e
// formatos de resposta. Nada aqui pode depender de runtime de servidor.

export * from './enums';
export * from './common/dinheiro';
export * from './common/opcional';
export * from './common/pagination';
export * from './common/api-response';
export * from './auth/auth.schemas';
export * from './crm/agendamentos.schemas';
export * from './crm/atendimentos.schemas';
export * from './crm/clientes.schemas';
export * from './crm/funil.schemas';
export * from './crm/orcamentos.schemas';
export * from './crm/servicos.schemas';
export * from './financeiro/lancamentos.schemas';
export * from './health';
