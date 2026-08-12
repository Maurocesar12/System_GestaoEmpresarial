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
function New-Senha {
  $bytes = [byte[]]::new(24)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$senhaApp = New-Senha
$senhaAdmin = New-Senha

Write-Host ''
Write-Host 'Criando roles e bancos...' -ForegroundColor Cyan
Write-Host "Digite a senha do superusuario '$Superusuario' quando o psql pedir." -ForegroundColor Yellow
Write-Host ''

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
