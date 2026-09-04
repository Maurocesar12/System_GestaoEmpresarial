// Contrato compartilhado entre a API (NestJS) e o frontend (Next.js).
// Fonte única de verdade para enums de domínio, schemas de validação e
// formatos de resposta. Nada aqui pode depender de runtime de servidor.

export * from './enums';
export * from './common/data';
export * from './common/dinheiro';
export * from './common/opcional';
export * from './common/paginacao';
export * from './common/resposta-api';
export * from './auth';
export * from './plataforma/equipe';
export * from './plataforma/permissoes';
export * from './plataforma/auditoria';
export * from './plataforma/configuracoes';
export * from './plataforma/planos';
export * from './ia/previsao-financeira';
export * from './crm/agendamentos';
export * from './crm/atendimentos';
export * from './crm/clientes';
export * from './crm/funil';
export * from './crm/lembretes';
export * from './crm/orcamentos';
export * from './crm/servicos';
export * from './financeiro/lancamentos';
export * from './financeiro/pro-labore';
export * from './financeiro/reservas';
export * from './health';
