param(
  [string]$Port = '55439'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
$DataDir = Join-Path $env:LOCALAPPDATA 'CASEPULSE\postgres-data'
$EnvFile = Join-Path $ProjectRoot '.env.local'
$TempPasswordFile = Join-Path $env:TEMP ("casepulse-pg-admin-" + [guid]::NewGuid().ToString('N') + '.txt')
$ServerStarted = $false

function Assert-NativeSuccess([string]$Operation) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Operation failed with exit code $LASTEXITCODE."
  }
}

try {
  if (!(Test-Path (Join-Path $PgBin 'initdb.exe'))) {
    throw "PostgreSQL 18 tools were not found at $PgBin. Update this script to your installed PostgreSQL bin path."
  }
  if (Test-Path $DataDir) {
    throw "Refusing to overwrite existing database directory: $DataDir"
  }
  if (!(Test-Path $EnvFile)) {
    throw "Expected local environment file not found: $EnvFile"
  }
  $existingEnv = Get-Content -LiteralPath $EnvFile
  if ($existingEnv | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' }) {
    throw "DATABASE_URL already exists in .env.local. Review it manually; this setup script will not overwrite it."
  }
  if (Get-NetTCPConnection -LocalPort ([int]$Port) -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Choose another unused local port and update the start script."
  }

  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $appBytes = New-Object byte[] 24
    $adminBytes = New-Object byte[] 24
    $rng.GetBytes($appBytes)
    $rng.GetBytes($adminBytes)
    $AppPassword = [System.BitConverter]::ToString($appBytes).Replace('-', '')
    $AdminPassword = [System.BitConverter]::ToString($adminBytes).Replace('-', '')
  } finally {
    $rng.Dispose()
  }
  Set-Content -LiteralPath $TempPasswordFile -Value $AdminPassword -Encoding ASCII
  New-Item -ItemType Directory -Path (Split-Path -Parent $DataDir) -Force | Out-Null

  Write-Output 'Initializing a dedicated CASEPULSE development PostgreSQL cluster.'
  & (Join-Path $PgBin 'initdb.exe') -D $DataDir -U postgres --auth-local=trust --auth-host=scram-sha-256 --pwfile=$TempPasswordFile --encoding=UTF8
  Assert-NativeSuccess 'initdb'
  Remove-Item -LiteralPath $TempPasswordFile -Force -ErrorAction SilentlyContinue

  & (Join-Path $PgBin 'pg_ctl.exe') -D $DataDir -l (Join-Path $DataDir 'postgres.log') -o "-h 127.0.0.1 -p $Port" -w start
  Assert-NativeSuccess 'Starting local PostgreSQL'
  $ServerStarted = $true

  $env:PGPASSWORD = $AdminPassword
  & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE casepulse_app LOGIN PASSWORD '$AppPassword';"
  Assert-NativeSuccess 'Creating CASEPULSE database role'

  & (Join-Path $PgBin 'createdb.exe') -h 127.0.0.1 -p $Port -U postgres -O casepulse_app casepulse_dev
  Assert-NativeSuccess 'Creating CASEPULSE development database'

  $env:PGPASSWORD = $AppPassword
  $env:DATABASE_URL = "postgresql://casepulse_app:$AppPassword@127.0.0.1:$Port/casepulse_dev"
  $env:NODE_ENV = 'development'

  Push-Location $ProjectRoot
  try {
    npm run db:migrate
    Assert-NativeSuccess 'Applying CASEPULSE migrations'
    $env:CASEPULSE_ALLOW_SYNTHETIC_SEED = 'true'
    npm run db:seed
    Assert-NativeSuccess 'Seeding synthetic CASEPULSE records'
    Remove-Item Env:CASEPULSE_ALLOW_SYNTHETIC_SEED -ErrorAction SilentlyContinue
  } finally {
    Pop-Location
  }

  $envContent = [Environment]::NewLine + "# Local-only CASEPULSE PostgreSQL development database (loopback port $Port)" + [Environment]::NewLine + "DATABASE_URL=postgresql://casepulse_app:$AppPassword@127.0.0.1:$Port/casepulse_dev" + [Environment]::NewLine
  [System.IO.File]::AppendAllText($EnvFile, $envContent, [System.Text.UTF8Encoding]::new($false))

  Write-Output 'CASEPULSE_DEV_DB_SETUP=SUCCESS'
  Write-Output "Database: casepulse_dev"
  Write-Output "Listener: 127.0.0.1:$Port (loopback only)"
  Write-Output 'DATABASE_URL added to ignored .env.local; the credential value was not printed.'
  Write-Output 'Seed data is synthetic and the local demo actor remains development-only.'
  Write-Output 'Start/stop the local database with scripts/postgres-dev-start.ps1 and scripts/postgres-dev-stop.ps1.'
} catch {
  Remove-Item -LiteralPath $TempPasswordFile -Force -ErrorAction SilentlyContinue
  Remove-Item Env:PGPASSWORD,Env:CASEPULSE_ALLOW_SYNTHETIC_SEED -ErrorAction SilentlyContinue
  if ($ServerStarted -or (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
    & (Join-Path $PgBin 'pg_ctl.exe') -D $DataDir -m fast -w stop 2>$null | Out-Null
  }
  if (Test-Path $DataDir) {
    Remove-Item -LiteralPath $DataDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-Error $_
  exit 1
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
