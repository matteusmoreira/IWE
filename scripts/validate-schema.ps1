Param()

Write-Host "Validando schema via dumps e migrações..."

$pub = "supabase/schema_public.sql"
$storage = "supabase/schema_storage.sql"
$seed = "supabase/migrations/20251105120003_seed_data.sql"

Function Test-FileExists($path) {
  if (!(Test-Path $path)) {
    Write-Host "[FAIL] Arquivo ausente: $path" -ForegroundColor Red
    return $false
  }
  return $true
}

$allOk = $true
$allOk = (Test-FileExists $pub) -and $allOk
$allOk = (Test-FileExists $storage) -and $allOk

Function Test-Pattern($file, $label, $patterns) {
  $ok = $true
  Write-Host "`n[$label]" -ForegroundColor Cyan
  foreach ($p in $patterns) {
    $res = Select-String -Path $file -Pattern $p -SimpleMatch
    if ($null -ne $res) {
      Write-Host " - PASS: $p" -ForegroundColor Green
    } else {
      Write-Host " - FAIL: $p" -ForegroundColor Red
      $ok = $false
    }
  }
  return $ok
}

$allOk = (Test-Pattern $pub "Tabelas essenciais (public)" @(
  '"public"."tenants"',
  '"public"."submissions"',
  '"public"."message_templates"',
  '"public"."file_uploads"'
)) -and $allOk

$allOk = (Test-Pattern $pub "Funções utilitárias" @(
  'FUNCTION "public"."is_admin_of_tenant"',
  'FUNCTION "public"."get_file_url"'
)) -and $allOk

$allOk = (Test-Pattern $pub "View de métricas" @(
  'VIEW "public"."dashboard_metrics"'
)) -and $allOk

$allOk = (Test-Pattern $pub "RLS e políticas (exemplos)" @(
  'ENABLE ROW LEVEL SECURITY',
  'Tenant-based access for message_templates',
  'Users can read their tenant file uploads'
)) -and $allOk

$allOk = (Test-Pattern $pub "Índices e constraints" @(
  'idx_message_templates_key',
  'idx_message_templates_tenant',
  'idx_file_uploads_submission',
  'idx_file_uploads_tenant',
  'message_templates_tenant_id_key_key'
)) -and $allOk

$allOk = (Test-Pattern $storage "Storage policies e vínculo com file_uploads" @(
  'form-submissions',
  'FROM "public"."file_uploads" "fu"'
)) -and $allOk

if (Test-Path $seed) {
  $seedContent = Get-Content $seed -Raw
  $count = ([regex]::Matches($seedContent, 'INSERT INTO message_templates')).Count
  if ($count -ge 3) {
    Write-Host "`n[PASS] Seeds de message_templates: $count inserções" -ForegroundColor Green
  } else {
    Write-Host "`n[FAIL] Seeds de message_templates: apenas $count inserções" -ForegroundColor Red
    $allOk = $false
  }
} else {
  Write-Host "`n[WARN] Seed file não encontrado: $seed" -ForegroundColor Yellow
}

$status = if ($allOk) { 'PASS' } else { 'FAIL' }
Write-Host "`nResumo: $status" -ForegroundColor White
if (-not $allOk) { exit 1 } else { exit 0 }