# Security Policy

Este repositorio contem um SaaS multiempresa de CRM e financeiro. A prioridade de seguranca e impedir vazamento entre tenants, proteger credenciais e manter historico/auditoria de operacoes sensiveis.

## Superficies Criticas

- Autenticacao, refresh token, recuperacao de senha e convite de equipe.
- Middleware de tenant, extensao Prisma e politicas RLS do PostgreSQL.
- Rotas financeiras, importacao/exportacao de planilhas e historico/auditoria.
- Integracoes externas: SMTP, OpenAI, Redis, Vercel, Render, Neon e futuro gateway de pagamento.

## Regras de Implementacao

- Toda rota nova deve nascer autenticada. Use `@Publico()` somente para login, cadastro, refresh, logout, aceite de convite, recuperacao de senha e health check.
- Toda leitura/escrita de dado de empresa deve usar `prisma.comTenant()` ou `prisma.comTenantExplicito()` quando o tenant vier de um job ou token validado.
- `prisma.semTenant()` exige justificativa real e deve ficar restrito a catalogos globais, login, cadastro, webhook e processamento operacional.
- Nunca grave senha, token, hash sensivel ou segredo em log/auditoria.
- Tokens enviados por e-mail devem ir em fragmento de URL quando a tela conseguir processar no cliente.
- Exportacoes CSV devem neutralizar celulas iniciadas por `=`, `+`, `-` ou `@`.
- Dados enviados a IA externa devem ser agregados e sem nomes de clientes, descricoes livres ou identificadores pessoais.

## Checklist Antes de Deploy

- Rodar typecheck, lint e testes dos modulos alterados.
- Validar que `DATABASE_URL` usa usuario sem `BYPASSRLS`.
- Configurar `JWT_SECRET` forte, `CORS_ORIGINS` exato, `APP_URL` publico e SMTP real.
- Revisar variaveis de ambiente da Vercel/Render/Neon sem segredos no repositorio.
- Testar login, refresh, logout, recuperacao de senha, aceite de convite e bloqueio cross-tenant.

## Reporte

Projeto privado. Falhas devem ser tratadas diretamente com o mantenedor do sistema e corrigidas antes de publicar detalhes.
