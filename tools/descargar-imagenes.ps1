# Descarga TODAS las imagenes de los buckets de Supabase (photos y avatars)
# a una carpeta local, respetando la estructura de carpetas.
#
# Uso (desde la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File tools\descargar-imagenes.ps1
#
# Opcional: cambiar la carpeta destino
#   powershell -ExecutionPolicy Bypass -File tools\descargar-imagenes.ps1 -Destino "D:\respaldo"

param(
  [string]$Destino = "$PSScriptRoot\..\respaldo-imagenes",
  [string[]]$Buckets = @("photos", "avatars")
)

$ErrorActionPreference = "Stop"

# --- Lee la URL y la llave del config.js del proyecto (no se escriben aqui) ---
$configPath = Join-Path $PSScriptRoot "..\js\config.js"
if (-not (Test-Path $configPath)) { throw "No encontre js/config.js junto al script." }
$config = Get-Content $configPath -Raw
$url = [regex]::Match($config, 'SUPABASE_URL\s*=\s*"([^"]+)"').Groups[1].Value
$key = [regex]::Match($config, 'SUPABASE_ANON_KEY\s*=\s*"([^"]+)"').Groups[1].Value
if (-not $url -or -not $key) { throw "No pude leer SUPABASE_URL / SUPABASE_ANON_KEY de config.js" }

$headers = @{ apikey = $key; Authorization = "Bearer $key" }

# --- Lista un bucket de forma recursiva (maneja subcarpetas y paginacion) ---
function Get-Archivos($bucket, $prefix) {
  $encontrados = @()
  $offset = 0
  while ($true) {
    $body = @{
      prefix = $prefix
      limit  = 100
      offset = $offset
      sortBy = @{ column = "name"; order = "asc" }
    } | ConvertTo-Json -Depth 5

    $resp = Invoke-RestMethod -Method Post -Uri "$url/storage/v1/object/list/$bucket" `
      -Headers $headers -ContentType "application/json" -Body $body

    if (-not $resp -or $resp.Count -eq 0) { break }

    foreach ($item in $resp) {
      $ruta = if ($prefix) { "$prefix/$($item.name)" } else { $item.name }
      if ($null -eq $item.id) {
        # Es una carpeta: entrar en ella
        $encontrados += Get-Archivos $bucket $ruta
      } else {
        $encontrados += $ruta
      }
    }

    if ($resp.Count -lt 100) { break }
    $offset += 100
  }
  return $encontrados
}

# --- Descarga ---
$totalOk = 0
$totalErr = 0

foreach ($bucket in $Buckets) {
  Write-Host ""
  Write-Host "=== Bucket: $bucket ===" -ForegroundColor Cyan

  try {
    $archivos = @(Get-Archivos $bucket "")
  } catch {
    Write-Host "  No pude listar el bucket: $($_.Exception.Message)" -ForegroundColor Red
    continue
  }

  Write-Host "  $($archivos.Count) archivo(s) encontrado(s)"

  $i = 0
  foreach ($archivo in $archivos) {
    $i++
    $destinoArchivo = Join-Path $Destino (Join-Path $bucket ($archivo -replace '/', '\'))
    $carpeta = Split-Path $destinoArchivo -Parent
    if (-not (Test-Path $carpeta)) { New-Item -ItemType Directory -Path $carpeta -Force | Out-Null }

    # Si ya existe, no lo vuelve a bajar (permite reanudar)
    if (Test-Path $destinoArchivo) {
      Write-Host "  [$i/$($archivos.Count)] ya existe: $archivo" -ForegroundColor DarkGray
      $totalOk++
      continue
    }

    $publicUrl = "$url/storage/v1/object/public/$bucket/$archivo"
    try {
      Invoke-WebRequest -Uri $publicUrl -OutFile $destinoArchivo -UseBasicParsing
      Write-Host "  [$i/$($archivos.Count)] $archivo"
      $totalOk++
    } catch {
      Write-Host "  [$i/$($archivos.Count)] ERROR en $archivo : $($_.Exception.Message)" -ForegroundColor Red
      $totalErr++
    }
  }
}

Write-Host ""
Write-Host "Listo. $totalOk descargada(s), $totalErr con error." -ForegroundColor Green
Write-Host "Carpeta: $((Resolve-Path $Destino).Path)"
