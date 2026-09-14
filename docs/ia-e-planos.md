# Inteligência artificial e planos

## Modelo comercial

Os identificadores (`slug`) antigos foram mantidos para não quebrar empresas já
cadastradas. Existem apenas dois planos vendáveis, ordenados por `nivel` no
banco:

| Slug           | Plano   | Base/mês | Incluídos | Máximo | Usuário adicional | Clientes | Previsões com IA |
| -------------- | ------- | -------: | --------: | -----: | ----------------: | -------: | ---------------: |
| `essencial`    | Básico  |   R$ 100 |         2 |      5 |             R$ 20 |      500 |   não disponível |
| `profissional` | Premium |   R$ 200 |         5 |     20 |             R$ 15 |    3.000 |          200/mês |

Os limites são validados pela API, e não somente escondidos na interface. Para
alterá-los, edite `apps/api/prisma/seed.ts`, gere uma migration quando houver
campo novo e rode o seed.

Para verificar no Postman, faça login, copie o `accessToken` e envie:

```http
POST /api/planos/verificar
Authorization: Bearer <accessToken>
Content-Type: application/json
```

A resposta traz `hierarquia: ["essencial", "profissional"]` e somente planos
ativos do catálogo comercial.

### Regra de cobrança por usuário

- A mensalidade é o preço-base mais os usuários **ativos** acima da quantidade
  incluída.
- Convites pendentes reservam uma vaga do limite, mas ainda não geram cobrança.
- Usuários desativados não entram na cobrança.
- O painel mostra uma estimativa mensal. A cobrança e eventual pró-rata só
  devem ser efetivados depois que o gateway e seus webhooks estiverem ligados.

Exemplo: uma empresa Premium com 8 usuários ativos paga a base de R$ 200 mais 3
adicionais de R$ 15, totalizando R$ 245 por mês.

## Os dois assistentes

O chat do painel abre de um jeito ou de outro conforme o plano da empresa. Quem
decide é a API (`GET /api/ia/chat/capacidades`), nunca a tela.

| Modo    | Planos  | Do que fala                        | Lê dados da empresa | Custo por pergunta |
| ------- | ------- | ---------------------------------- | ------------------- | ------------------ |
| `ajuda` | todos   | como usar o sistema, tela por tela | não                 | zero               |
| `ia`    | Premium | caixa, funil, agenda, carteira     | sim, com permissão  | tokens da OpenAI   |

O modo `ajuda` responde a partir de uma base de conhecimento versionada em
`apps/api/src/modules/ia/ajuda/base-conhecimento.ts`. Cada tópico traz termos de
busca, o texto da resposta e a tela que resolve o assunto. Mudou uma tela? Edite
o tópico dela — a lógica de casamento não muda.

O modo `ia` conversa sobre o **mesmo panorama que o painel mostra**: o
`ChatIaService` reaproveita o `PainelService`, o que garante que o assistente
nunca contradiga a tela aberta ao lado e que ele só enxergue o que as permissões
de quem pergunta permitem.

## Como a previsão funciona

A previsão é exclusiva do plano Premium. Quem não tem `iaHabilitada` recebe 403
com a mensagem de upgrade — antes, todo plano gerava três previsões por mês com
uma análise local por regras que tinha aparência de IA.

1. A API reúne os totais financeiros por mês e o retrato do negócio: propostas
   em aberto, taxa de conversão, ticket médio, agendamentos futuros, pró-labore
   vigente, contas vencidas e as maiores saídas por categoria.
2. O cálculo local projeta o caixa com média ponderada do histórico e as contas
   futuras conhecidas. O pró-labore entra como **piso** das saídas, e a receita
   provável do funil viaja em campo separado — dinheiro possível não se soma a
   dinheiro combinado.
3. A IA explica cenários, riscos, oportunidades e próximas ações em JSON
   estruturado.
4. O resultado, os tokens e o custo estimado ficam registrados por empresa e por
   usuário, junto da base que alimentou a conta (`baseDeDados`, na resposta).

Nomes de clientes e descrições de lançamentos não são enviados à OpenAI — só
agregados. Toda previsão é uma estimativa gerencial e não substitui contador.

## Desenvolvimento sem conta OpenAI

Deixe `OPENAI_API_KEY` vazia. O assistente de ajuda funciona normalmente, porque
não depende de fornecedor nenhum. No Premium, a previsão e o chat com IA caem no
analisador local, que se identifica como tal na tela e tem custo zero — é a mesma
rede de segurança usada quando a OpenAI falha em produção.

## Conectar a OpenAI no Render

1. Crie uma chave de API na conta do projeto OpenAI.
2. No Render, abra o serviço da API e acesse **Environment**.
3. Preencha `OPENAI_API_KEY` e mantenha `OPENAI_MODEL=gpt-5.6-luna`.
4. Faça um novo deploy.
5. Abra **Plano e consumo**. A integração deve aparecer como conectada, e novas
   previsões passam a registrar tokens e custo estimado.

A chave existe somente no Render/API. Nunca crie uma variável
`NEXT_PUBLIC_OPENAI_API_KEY` e nunca coloque a chave na Vercel ou no código.

Os preços por milhão de tokens usados no acompanhamento são configuráveis por
ambiente. Confira os valores atuais na
[página oficial de preços](https://developers.openai.com/api/docs/pricing) antes
de publicar:

- `OPENAI_CUSTO_INPUT_USD_MILHAO`
- `OPENAI_CUSTO_OUTPUT_USD_MILHAO`

O consumo mostrado é uma estimativa técnica. Impostos, câmbio e outros itens da
fatura do provedor não estão incluídos.

## Cobrança dos seus clientes

A tabela `Assinatura` já reserva a integração com o gateway, mas a troca de
plano não é liberada pela interface enquanto webhooks e confirmação de
pagamento não estiverem conectados. Isso impede que alguém altere o plano pelo
navegador sem pagar.
