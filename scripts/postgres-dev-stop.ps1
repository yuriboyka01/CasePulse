$ErrorActionPreference = 'Stop'
$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
$DataDir = Join-Path $env:LOCALAPPDATA 'CASEPULSE\postgres-data'

if (!(Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
  Write-Output 'CASEPULSE development PostgreSQL is not initialized.'
  exit 0
}

& (Join-Path $PgBin 'pg_ctl.exe') -D $DataDir status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output 'CASEPULSE development PostgreSQL is already stopped.'
  exit 0
}

& (Join-Path $PgBin 'pg_ctl.exe') -D $DataDir -m fast -w stop
if ($LASTEXITCODE -ne 0) {
  throw 'Could not stop CASEPULSE development PostgreSQL.'
}
Write-Output 'CASEPULSE development PostgreSQL stopped.'
