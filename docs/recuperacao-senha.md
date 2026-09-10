# Recuperacao de senha

O login oferece o link `/recuperar-senha`. O usuario informa o e-mail e recebe
um link valido por 20 minutos. A nova senha segue a politica `senhaSchema`.

## Configuracao

- `SMTP_URL`: transporte SMTP autenticado.
- `EMAIL_REMETENTE`: remetente autorizado no provedor de e-mail.
- `APP_URL`: URL publica HTTPS do frontend em producao.
- `JWT_SECRET`: segredo da API, nunca exposto ao frontend.

Sem transporte SMTP real, o endpoint informa indisponibilidade. Links de
recuperacao nao sao enviados ao notificador simulado e nao aparecem nos logs.
Nao foi realizado envio real de e-mail durante a implementacao.

## Garantias e limites

O token tem finalidade e audiencia exclusivas e fica no fragmento da URL.
A pagina remove o fragmento apos ler o token. Recarregar a pagina exige abrir
novamente o link original do e-mail.

A assinatura do token incorpora uma versao derivada do hash da senha.
A troca atomica invalida todos os links anteriores e revoga refresh tokens.
Access tokens ja emitidos continuam validos ate sua expiracao configurada
(15 minutos por padrao). A resposta da solicitacao nao informa se a conta existe.
Falhas de SMTP sao registradas sem incluir destinatario, token ou corpo.

## Verificacao

Testes unitarios cobrem reutilizacao, expiracao, token de finalidade incorreta,
conta inexistente e perda da disputa por atualizacao concorrente.
Antes de liberar em producao, testar entrega e redefinicao com uma conta
controlada usando o SMTP e o dominio reais.
