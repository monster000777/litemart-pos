$sqlite = 'E:\A-Github-project\autoGLM\ADB\platform-tools-latest-windows\platform-tools\sqlite3.exe'
$prismaDir = Join-Path $PSScriptRoot '..\prisma'
$prismaDir = [System.IO.Path]::GetFullPath($prismaDir)
$db = Join-Path $prismaDir 'dev.db'

if (-not (Test-Path $sqlite)) {
  Write-Error "sqlite3 not found: $sqlite"
  exit 1
}

if (-not (Test-Path $db)) {
  Write-Error "database not found: $db"
  exit 1
}

Push-Location $prismaDir
try {
  & $sqlite '.\dev.db' "PRAGMA integrity_check;"
} finally {
  Pop-Location
}
