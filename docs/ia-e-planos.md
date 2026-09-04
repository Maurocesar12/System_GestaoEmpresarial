# Inteligência artificial e planos

## Modelo comercial

Os identificadores (`slug`) antigos foram mantidos para não quebrar empresas já
cadastradas. Os nomes e limites vigentes ficam no seed:

| Slug           | Plano  | Base/mês | Incluídos | Máximo | Usuário adicional | Clientes | Previsões com IA |
| -------------- | ------ | -------: | --------: | -----: | ----------------: | -------: | ---------------: |
| `essencial`    | Básico |   R$ 100 |         2 |      5 |             R$ 20 |      500 |   não disponível |
| `profissional` | Pro    |   R$ 200 |         5 |     20 |             R$ 15 |    3.000 |          200/mês |

Os limites são validados pela API, e não somente escondidos na interface. Para
alterá-los, edite `apps/api/prisma/seed.ts` e rode o seed.

### Regra de cobrança por usuário

- A mensalidade é o preço-base mais os usuários **ativos** acima da quantidade
  incluída.
- Convites pendentes reservam uma vaga do limite, mas ainda não geram cobrança.
- Usuários desativados não entram na cobrança.
- O painel mostra uma estimativa mensal. A cobrança e eventual pró-rata só
  devem ser efetivados depois que o gateway e seus webhooks estiverem ligados.

Exemplo: uma empresa Pro com 8 usuários ativos paga a base de R$ 200 mais 3
adicionais de R$ 15, totalizando R$ 245 por mês.

## Como a previsão funciona

1. A API reúne apenas totais financeiros da empresa por mês.
2. O cálculo local cria uma base conservadora usando média ponderada do
   histórico e contas futuras já conhecidas.
3. A IA explica riscos e próximas ações em JSON estruturado.
4. O resultado, tokens e custo estimado ficam registrados por empresa e por
   usuário.

Nomes de clientes e descrições de lançamentos não são enviados à OpenAI. Toda
previsão é uma estimativa gerencial e não substitui contador.

## Desenvolvimento sem conta OpenAI

Deixe `OPENAI_API_KEY` vazia. A previsão usa o analisador local, mostra
claramente “modo de demonstração” e tem custo zero. Isso permite desenvolver e
testar toda a experiência antes de cadastrar um meio de pagamento.

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
