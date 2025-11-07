#
# install-playwright-revision.ps1
#
# Objetivo: Detectar/instalar automaticamente a revisão de Chromium Headless Shell
# esperada pelo MCP Playwright (por padrão 1179), iterando por versões do
# @playwright/test até que o diretório "chromium_headless_shell-<revisão>" apareça
# no cache do usuário (Windows: %LOCALAPPDATA%\ms-playwright).
#
# Uso básico:
#   powershell -ExecutionPolicy Bypass -File scripts\install-playwright-revision.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-playwright-revision.ps1 -Revision 1179
#
# Opções:
#   -Revision <string>      Revisão esperada (default: $env:MCP_PLAYWRIGHT_EXPECTED_REVISION ou 1179)
#   -ClearPartial           Remove caches de headless shell que não são da revisão alvo
#   -OnlyShell              Instala apenas o headless shell (padrão: ativo)
#
# Observações:
# - O script usa npx para chamar o CLI do Playwright em várias versões.
# - Parará assim que encontrar headless_shell.exe em
#   %LOCALAPPDATA%\ms-playwright\chromium_headless_shell-<Revision>\chrome-win\headless_shell.exe
# - Se necessário, também tenta instalar o Chromium "headed" na mesma versão.

param(
  [string]$Revision = $env:MCP_PLAYWRIGHT_EXPECTED_REVISION,
  [string]$ErrorTextFile,
  [string]$ErrorText,
  [string[]]$Versions = @(
    "1.56.1",
    "1.55.0",
    "1.54.2",
    "1.53.0",
    "1.52.0",
    "1.51.0",
    "1.50.0",
    "1.49.1",
    "1.47.0",
    "1.46.0",
    "1.45.0"
  ),
  [string]$CachePath = $env:LOCALAPPDATA,
  [switch]$ClearPartial = $false,
  [switch]$OnlyShell = $true
)

function Get-ExpectedRevision {
  param([string]$DefaultRevision)
  $content = $null
  if ($ErrorTextFile -and (Test-Path -LiteralPath $ErrorTextFile)) {
    try { $content = Get-Content -LiteralPath $ErrorTextFile -Raw } catch {}
  } elseif ($ErrorText -and $ErrorText.Trim() -ne "") {
    $content = $ErrorText
  }
  if ($content) {
    $m = [regex]::Match($content, "chromium_headless_shell-(\d+)")
    if ($m.Success) { return $m.Groups[1].Value }
  }
  return $DefaultRevision
}

if (-not $Revision -or $Revision.Trim() -eq "") { $Revision = Get-ExpectedRevision -DefaultRevision "1179" }

$msPlaywrightPath = Join-Path $CachePath "ms-playwright"
$expectedShellDir = Join-Path $msPlaywrightPath ("chromium_headless_shell-" + $Revision)
$expectedShellExe = Join-Path $expectedShellDir "chrome-win/headless_shell.exe"

function Test-Installed {
  if (Test-Path -LiteralPath $expectedShellExe) { return $true } else { return $false }
}

function Show-Existing {
  if (Test-Path -LiteralPath $msPlaywrightPath) {
    Get-ChildItem -Path $msPlaywrightPath -Directory |
      Where-Object { $_.Name -like "chromium_headless_shell-*" -or $_.Name -like "chromium-*" } |
      ForEach-Object { Write-Host "- " $_.FullName }
  } else {
    Write-Host "Cache path não encontrado: $msPlaywrightPath"
  }
}

Write-Host "[Playwright MCP Installer] Revisão esperada: $Revision"
Write-Host "[Playwright MCP Installer] Verificando: $expectedShellExe"

if (Test-Installed) {
  Write-Host "[OK] Headless shell já instalado na revisão $Revision."; exit 0
}

if ($ClearPartial) {
  Write-Host "[Limpeza] Removendo diretórios headless shell que não são da revisão $Revision..."
  if (Test-Path -LiteralPath $msPlaywrightPath) {
    Get-ChildItem -Path $msPlaywrightPath -Directory |
      Where-Object { $_.Name -like "chromium_headless_shell-*" -and $_.Name -ne ("chromium_headless_shell-" + $Revision) } |
      ForEach-Object {
        Write-Host "[Delete] " $_.FullName
        Remove-Item -Recurse -Force -LiteralPath $_.FullName
      }
  }
}

foreach ($v in $Versions) {
  Write-Host "[Tentativa] Instalando @playwright/test v$v (shell: $($OnlyShell.IsPresent))..."

  $args = @("--yes","-p", "@playwright/test@$v", "playwright", "install")
  if ($OnlyShell) { $args += "--only-shell" }

  Write-Host "[Cmd] npx $($args -join ' ')"
  try {
    $process = Start-Process -FilePath "npx" -ArgumentList $args -NoNewWindow -Wait -PassThru
    Write-Host "[Exit] npx saiu com código $($process.ExitCode)"
  } catch {
    Write-Warning "[Erro] Falha ao instalar headless shell v$($v): $($_.Exception.Message)"
  }

  if (Test-Installed) {
    Write-Host "[Sucesso] Encontrado: $expectedShellExe"
    exit 0
  } else {
    Write-Host "[Info] Revisão $Revision não encontrada após v$v. Tentando Chromium headed..."
    $args2 = @("--yes","-p", "@playwright/test@$v", "playwright", "install", "chromium")
    Write-Host "[Cmd] npx $($args2 -join ' ')"
    try {
      $p2 = Start-Process -FilePath "npx" -ArgumentList $args2 -NoNewWindow -Wait -PassThru
      Write-Host "[Exit] npx saiu com código $($p2.ExitCode)"
    } catch {
      Write-Warning "[Erro] Falha ao instalar Chromium headed v$($v): $($_.Exception.Message)"
    }

    if (Test-Installed) {
      Write-Host "[Sucesso] Encontrado após headed: $expectedShellExe"
      exit 0
    }
  }
}

Write-Host "[Falha] Não foi possível instalar 'chromium_headless_shell-$Revision'."
Write-Host "[Cache] Conteúdo atual em $($msPlaywrightPath):"; Show-Existing
exit 2