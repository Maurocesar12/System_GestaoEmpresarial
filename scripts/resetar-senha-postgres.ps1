<#
.SYNOPSIS
  Redefine a senha do superusuário `postgres` quando ela foi esquecida.

.DESCRIPTION
  PRECISA SER EXECUTADO COMO ADMINISTRADOR.

  O PostgreSQL não guarda a senha em texto — não há como descobri-la, só
  substituí-la. O procedimento padrão é:

    1. Fazer backup do pg_hba.conf (o arquivo que decide como o banco autentica)
    2. Trocar `scram-sha-256` por `trust`, que aceita conexão local sem senha
    3. Reiniciar o serviço para a mudança valer
    4. Conectar sem senha e definir a nova
    5. Restaurar o arquivo original
    6. Reiniciar de novo

  Os passos 5 e 6 rodam dentro de um `finally`: mesmo que algo falhe no meio,
  a configuração original volta. Isso importa porque `trust` deixa qualquer
  processo da máquina conectar ao banco sem senha — é uma janela de poucos
  segundos, e não pode ficar aberta por acidente.

.PARAMETER NovaSenha
  A nova senha. Se você não passar, o script pede no terminal sem exibi-la.
  Ela nunca é gravada em arquivo nem aparece no histórico do PowerShell.

.EXAMPLE
  # Abra o PowerShell como Administrador e rode:
  .\scripts\resetar-senha-postgres.ps1
#>

[CmdletBinding()]
param(
  [System.Security.SecureString]$NovaSenha,
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$PgData = 'C:\Program Files\PostgreSQL\17\data',
  [string]$Servico = 'postgresql-x64-17'
)

$ErrorActionPreference = 'Stop'

# --- Verificações antes de mexer em qualquer coisa --------------------------

$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$ehAdmin = ([Security.Principal.WindowsPrincipal]$identidade).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $ehAdmin) {
  throw 'Este script precisa de privilégio de Administrador. Abra o PowerShell com "Executar como administrador" e rode de novo.'
}

$psql = Join-Path $PgBin 'psql.exe'
$hba = Join-Path $PgData 'pg_hba.conf'

foreach ($caminho in @($psql, $hba)) {
  if (-not (Test-Path $caminho)) {
    throw "Não encontrei '$caminho'. Ajuste -PgBin / -PgData se o PostgreSQL está em outro lugar."
  }
}

if (-not $NovaSenha) {
  $NovaSenha = Read-Host -Prompt 'Nova senha para o usuario postgres' -AsSecureString
}

# Converte a SecureString apenas no momento do uso, e limpa a memória logo em
# seguida. É pouco contra um atacante com acesso à máquina, mas evita que a
# senha fique visível em dump de processo ou no histórico do terminal.
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($NovaSenha)
try {
  $senhaTexto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
}

if ([string]::IsNullOrWhiteSpace($senhaTexto)) {
  throw 'Senha vazia. Nada foi alterado.'
}

# --- Backup ------------------------------------------------------------------

$backup = "$hba.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $hba $backup
Write-Host "Backup do pg_hba.conf em: $backup" -ForegroundColor DarkGray

$restaurado = $false

try {
  # --- Liberar autenticação local temporariamente ---------------------------

  Write-Host 'Liberando autenticacao local temporariamente...' -ForegroundColor Cyan

  # Troca só o método de autenticação, preservando o resto de cada linha.
  (Get-Content $hba) -replace '(^\s*(?:host|local)\s+.*\s+)scram-sha-256\s*$', '$1trust' |
    Set-Content $hba -Encoding ascii

  Restart-Service -Name $Servico -Force
  Start-Sleep -Seconds 3

  # --- Trocar a senha --------------------------------------------------------

  Write-Host 'Definindo a nova senha...' -ForegroundColor Cyan

  # O SQL vai pela entrada padrão, e não como argumento de linha de comando:
  # argumentos ficam visíveis na lista de processos do sistema, e a senha
  # estaria entre eles.
  #
  # Dentro do SQL, a senha é um literal com as aspas simples duplicadas — é o
  # escape que o PostgreSQL espera. Sem ele, uma senha contendo aspas quebraria
  # o comando.
  $senhaEscapada = $senhaTexto.Replace("'", "''")
  $env:PGPASSWORD = ''

  "ALTER USER postgres WITH PASSWORD '$senhaEscapada';" | & $psql `
    --host localhost `
    --username postgres `
    --dbname postgres `
    --set ON_ERROR_STOP=1

  if ($LASTEXITCODE -ne 0) {
    throw "psql falhou com codigo $LASTEXITCODE."
  }
}
finally {
  # --- Restaurar a configuração original -------------------------------------
  # Roda mesmo se algo acima falhar: a janela de `trust` não pode ficar aberta.

  Write-Host 'Restaurando a configuracao original...' -ForegroundColor Cyan

  Copy-Item $backup $hba -Force
  Restart-Service -Name $Servico -Force
  Start-Sleep -Seconds 3

  $restaurado = $true
  $senhaTexto = $null
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if ($restaurado) {
  Write-Host ''
  Write-Host 'Senha redefinida e autenticacao restaurada.' -ForegroundColor Green
  Write-Host ''
  Write-Host 'Proximo passo:' -ForegroundColor Cyan
  Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\setup-database.ps1'
  Write-Host ''
  Write-Host "Se tudo estiver certo, pode apagar o backup: $backup" -ForegroundColor DarkGray
  Write-Host ''
}
