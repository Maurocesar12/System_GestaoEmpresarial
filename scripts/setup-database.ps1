<#
.SYNOPSIS
  Prepara o banco de desenvolvimento: cria os roles, os bancos e grava as
  connection strings em apps/api/.env.

.DESCRIPTION
  Você vai digitar a senha do superusuário `postgres` — a que definiu ao
  instalar o PostgreSQL. Ela é usada apenas para esta conexão e não é gravada
  em lugar nenhum.

  As senhas dos roles da aplicação são geradas aleatoriamente aqui e gravadas
  em apps/api/.env, que está fora do versionamento.

.EXAMPLE
  .\scripts\setup-database.ps1
#>

[CmdletBinding()]
param(
  [System.Security.SecureString]$SenhaSuperusuario,
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$PgHost = 'localhost',
  [int]$PgPort = 5432,
  [string]$Superusuario = 'postgres'
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$psql = Join-Path $PgBin 'psql.exe'
$sql = Join-Path $PSScriptRoot 'setup-database.sql'
$envPath = Join-Path $raiz 'apps\api\.env'

if (-not (Test-Path $psql)) {
  throw "psql.exe não encontrado em '$PgBin'. Passe o caminho com -PgBin."
}

# Senhas longas e aleatórias: ninguém precisa digitá-las, então não há motivo
# para serem curtas. base64url evita caracteres que precisariam de escape na
# connection string.
#
# Usa RNGCryptoServiceProvider, e não o mais moderno RandomNumberGenerator.Fill:
# o Fill só existe a partir do PowerShell 7, e este script precisa rodar também
# no Windows PowerShell 5.1, que vem instalado por padrão no Windows.
function New-Senha {
  $bytes = New-Object byte[] 24
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try {
    $rng.GetBytes($bytes)
  }
  finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$senhaApp = New-Senha
$senhaAdmin = New-Senha

if (-not $SenhaSuperusuario) {
  $SenhaSuperusuario = Read-Host -Prompt "Senha do superusuario '$Superusuario'" -AsSecureString
}

# A senha vai para o psql pela variável de ambiente PGPASSWORD, e não como
# argumento: argumentos de linha de comando ficam visíveis na lista de
# processos do sistema.
#
# Também é o que evita o psql pedir a senha três vezes: o script SQL usa
# `\connect` para entrar em cada banco criado, e cada reconexão autentica de novo.
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SenhaSuperusuario)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
}

Write-Host ''
Write-Host 'Criando roles e bancos...' -ForegroundColor Cyan
Write-Host ''

try {
  & $psql `
    --host $PgHost `
    --port $PgPort `
    --username $Superusuario `
    --dbname postgres `
    --set ON_ERROR_STOP=1 `
    --variable "senha_app=$senhaApp" `
    --variable "senha_admin=$senhaAdmin" `
    --file $sql

  if ($LASTEXITCODE -ne 0) {
    throw "psql terminou com erro $LASTEXITCODE. Nada foi gravado no .env."
  }
}
finally {
  # A senha do superusuário não fica no ambiente depois que o script termina.
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# --- Gravar as connection strings no .env ---------------------------------

if (-not (Test-Path $envPath)) {
  throw "Arquivo '$envPath' não existe. Copie de apps/api/.env.example primeiro."
}

$urlApp = "postgresql://gestao_app:$senhaApp@${PgHost}:$PgPort/gestao_dev?schema=public"
$urlTeste = "postgresql://gestao_app:$senhaApp@${PgHost}:$PgPort/gestao_test?schema=public"
$urlAdmin = "postgresql://gestao_admin:$senhaAdmin@${PgHost}:$PgPort/gestao_dev?schema=public"

$linhas = Get-Content $envPath

function Set-Variavel {
  param([string[]]$Conteudo, [string]$Nome, [string]$Valor)

  if ($Conteudo -match "^$Nome=") {
    return $Conteudo -replace "^$Nome=.*", "$Nome=$Valor"
  }
  return $Conteudo + "$Nome=$Valor"
}

$linhas = Set-Variavel $linhas 'DATABASE_URL' $urlApp
$linhas = Set-Variavel $linhas 'TEST_DATABASE_URL' $urlTeste
$linhas = Set-Variavel $linhas 'ADMIN_DATABASE_URL' $urlAdmin

Set-Content -Path $envPath -Value $linhas -Encoding utf8

Write-Host ''
Write-Host 'Pronto.' -ForegroundColor Green
Write-Host '  Bancos:  gestao_dev, gestao_test'
Write-Host '  Roles:   gestao_app (sem BYPASSRLS), gestao_admin (com BYPASSRLS)'
Write-Host '  Escrito: apps/api/.env'
Write-Host ''
Write-Host 'Proximo passo:' -ForegroundColor Cyan
Write-Host '  pnpm --filter @gestao/api db:migrate'
Write-Host ''
