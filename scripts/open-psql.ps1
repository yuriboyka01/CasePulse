$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot '.env.local'
if (!(Test-Path $EnvFile)) {
  Write-Error "Could not find .env.local file in $ProjectRoot"
  exit 1
}
$match = Get-Content -LiteralPath $EnvFile | Select-String '^DATABASE_URL=(.+)$'
if (!$match) {
  Write-Error "DATABASE_URL not found in .env.local"
  exit 1
}
$dbUrl = $match.Matches.Groups[1].Value.Trim('"', "'")
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" $dbUrl $args
