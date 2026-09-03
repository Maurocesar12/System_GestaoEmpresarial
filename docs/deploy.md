# Deploy gratuito — Vercel + Render + Neon

Como colocar o sistema no ar sem custo, para validar o produto com empresas
reais antes de investir em infraestrutura paga.

| Peça       | Onde         | Plano        |
| ---------- | ------------ | ------------ |
| Frontend   | Vercel       | Hobby        |
| API        | Render       | Free         |
| PostgreSQL | Neon         | Free         |
| Redis      | — (opcional) | Upstash Free |

---

## Antes de começar: três limites que valem entender

**A licença do plano Hobby da Vercel proíbe uso comercial.** Enquanto for teste,
demonstração ou portfólio, tudo certo. No dia em que você cobrar de um cliente —
mesmo um, mesmo R$ 50 — precisa migrar para o Pro. Não é letra miúda distante:
projetos são derrubados por isso. Como este é um SaaS feito para cobrar de PME,
trate o gratuito como fase com data para acabar.

**A API hiberna depois de ~15 minutos sem tráfego.** O primeiro acesso depois
disso leva 30–60 segundos para responder. E, enquanto ela dorme, o
`@Cron(EVERY_MINUTE)` de `lembretes.agendador.ts` não roda — os lembretes só são
enviados quando alguém acorda a API. Para demonstração isso é aceitável; só não
confunda com o comportamento de produção.

**O banco fica nos Estados Unidos.** Some algo em torno de 100–150 ms a cada
requisição para quem acessa do Brasil. Escolha a mesma região no Render e no Neon
— o tráfego entre API e banco é o mais sensível, porque cada operação abre uma
transação com `BEGIN`, `set_config` e `COMMIT`.

---

## 1. Banco no Neon

1. Crie um projeto em [neon.tech](https://neon.tech), região **AWS US West
   (Oregon)** para casar com o Render.
2. Copie a connection string. Ela tem esta forma:

   ```
   postgresql://usuario:senha@ep-algo-123.us-west-2.aws.neon.tech/neondb?sslmode=require
   ```

3. **Confira que termina em `?sslmode=require`.** O driver `pg` lê esse
   parâmetro da própria URL; sem ele a conexão é recusada pelo Neon.

Não precisa criar tabela nem role: as migrations fazem tudo, e a política de RLS
usa `FORCE ROW LEVEL SECURITY`, que se aplica ao dono do banco — exatamente o
role que o Neon te entrega.

> **Por que Neon e não o Postgres gratuito do Render:** o do Render expira e
> leva os dados junto. O Neon hiberna quando fica parado, mas acorda na conexão
> e não apaga nada.

---

## 2. API no Render

1. Em [render.com](https://render.com), **New → Blueprint** e aponte para o
   repositório. Ele lê o `render.yaml` da raiz e já cria o serviço configurado.
2. O Render vai pedir os cinco valores marcados como `sync: false`:

   | Variável          | Valor                                                           |
   | ----------------- | --------------------------------------------------------------- |
   | `DATABASE_URL`    | A connection string do Neon, com `?sslmode=require`             |
   | `CORS_ORIGINS`    | A URL da Vercel — preencha depois do passo 3, deixe vazio agora |
   | `APP_URL`         | A mesma URL da Vercel, usada para montar os links dos convites  |
   | `SMTP_URL`        | URL SMTP completa; veja a configuração de e-mail abaixo         |
   | `EMAIL_REMETENTE` | Nome e endereço do domínio verificado                           |

3. Publique. O build roda migrations automaticamente (`prisma migrate deploy`).

**Confira que subiu** abrindo `https://SEU-SERVICO.onrender.com/health`. A
resposta é um JSON com `status: "ok"`.

No log do primeiro boot você deve ver as políticas de RLS sendo aplicadas e dois
avisos esperados, de `REDIS_URL` e `SMTP_URL` não configuradas.

---

## 3. Frontend na Vercel

1. Em [vercel.com](https://vercel.com), **Add New → Project**, importe o
   repositório.
2. Configure assim:

   | Campo            | Valor                                                    |
   | ---------------- | -------------------------------------------------------- |
   | Framework Preset | Next.js                                                  |
   | Root Directory   | `apps/web`                                               |
   | Build Command    | `pnpm --filter @gestao/shared-types build && next build` |
   | Install Command  | (deixe o padrão — a Vercel detecta o workspace pnpm)     |

   O _Build Command_ precisa desse prefixo porque a web importa
   `@gestao/shared-types` compilado, e a Vercel constrói apenas o diretório raiz
   que você apontou.

3. Variável de ambiente:

   | Variável              | Valor                                                       |
   | --------------------- | ----------------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL` | `https://SEU-SERVICO.onrender.com` — **sem barra no final** |

4. Publique.

---

## 4. Fechar o círculo do CORS

Com a URL da Vercel em mãos, volte ao Render e preencha `CORS_ORIGINS` e
`APP_URL` com ela (ex.: `https://gestao-empresarial.vercel.app`, sem barra no
final). Salvar reinicia o serviço.

Você deve fazer isso mesmo que pareça desnecessário. Hoje o navegador não chama a
API diretamente — quem chama é o servidor do Next, por `apiComSessao`, e
requisição servidor a servidor não passa por CORS. Mas a configuração existe e é
lida no boot; deixá-la errada é uma armadilha para o dia em que algum componente
de cliente precisar falar com a API.

---

## 5. Conferir de ponta a ponta

1. Abra a URL da Vercel. A página inicial deve carregar.
2. **Cadastre uma empresa.** Isso exercita o caminho mais delicado do sistema: o
   `criarNovoTenant`, que gera o UUID na aplicação antes de inserir porque a
   política de RLS não abre exceção para o cadastro.
3. Entre no painel e cadastre um cliente. Ele deve aparecer no funil sozinho.
4. Crie um lançamento no financeiro e confira o fluxo de caixa.

Se o passo 2 falhar com erro de política, o problema é quase sempre a migration
de RLS não ter rodado — confira o log de build do Render.

---

## Configurar o envio real de e-mail

O sistema usa o mesmo SMTP para convites de funcionários e lembretes. Com o
Resend, faça o seguinte:

1. Cadastre um domínio ou subdomínio de envio no
   [painel do Resend](https://resend.com/domains).
2. Copie para o seu DNS os registros SPF e DKIM exibidos pelo provedor e espere
   o domínio aparecer como verificado.
3. Crie uma API key exclusiva para produção.
4. No Render, preencha `SMTP_URL` com
   `smtps://resend:re_SUA_CHAVE@smtp.resend.com:465`.
5. Preencha `EMAIL_REMETENTE` com um endereço do domínio verificado, por exemplo
   `Minha Empresa <notificacoes@envios.minhaempresa.com.br>`.
6. Depois do deploy, abra **Configurações → Teste de envio de e-mail** e envie
   uma mensagem para o seu próprio endereço.

Nunca coloque a API key no `.env.example`, no código ou em um commit. Em
desenvolvimento, deixar `SMTP_URL` vazia é intencional: a mensagem aparece no
terminal sem ser enviada para uma pessoa real.

---

## O que fica desligado no plano gratuito

| Recurso                       | Situação                                                               |
| ----------------------------- | ---------------------------------------------------------------------- |
| Envio automático de lembretes | Desligado sem `REDIS_URL`. Os lembretes são criados e ficam pendentes. |
| E-mail transacional           | Sem `SMTP_URL`, a mensagem vai para o log em vez do destinatário.      |
| Cron de varredura             | Só roda enquanto a API está acordada.                                  |

Para ligar os dois primeiros: crie um banco Redis gratuito no
[Upstash](https://upstash.com) e preencha `REDIS_URL`; para o e-mail, qualquer
SMTP serve — Resend, Brevo e Mailtrap têm plano gratuito.

---

## Quando sair do gratuito

O gatilho não é técnico, é comercial: **o primeiro cliente pagante**. Nesse
momento a licença da Vercel passa a exigir o Pro, e a hibernação da API deixa de
ser um detalhe para virar um cliente vendo o sistema fora do ar.

As duas saídas, em ordem de custo:

- **VPS única** (~R$30–60/mês) com tudo junto — API, web, Postgres e Redis. Mais
  barato, sem hibernar, latência de banco perto de zero. Em troca, backup e
  atualização passam a ser seus.
- **Os mesmos serviços, nos planos pagos** (~US$34/mês). Confortável e mais caro,
  e você paga em dólar enquanto cobra em real.
