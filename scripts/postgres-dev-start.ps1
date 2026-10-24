param([string]$Port = '55439')

$ErrorActionPreference = 'Stop'
$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
$DataDir = Join-Path $env:LOCALAPPDATA 'CASEPULSE\postgres-data'

if (!(Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
  throw "CASEPULSE development database is not initialized. Run npm run db:dev:setup first."
}

& (Join-Path $PgBin 'pg_ctl.exe') -D $DataDir status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "CASEPULSE PostgreSQL is already running on 127.0.0.1:$Port."
  exit 0
}

& (Join-Path $PgBin 'pg_ctl.exe') -D $DataDir -l (Join-Path $DataDir 'postgres.log') -o "-h 127.0.0.1 -p $Port" -w start
if ($LASTEXITCODE -ne 0) {
  throw "Could not start CASEPULSE PostgreSQL."
}
Write-Output "CASEPULSE PostgreSQL started on 127.0.0.1:$Port."
