#!/usr/bin/env node
/*
 * Validação automática do schema Supabase.
 * - Lê dumps gerados em supabase/schema_public.sql e supabase/schema_storage.sql
 * - Verifica presença de tabelas, funções, view, índices, constraints e políticas RLS.
 * - Checa se há seeds de message_templates na migração de seed.
 */
const fs = require('fs');
const path = require('path');

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return null;
  }
}

function checkPatterns(content, patterns) {
  return patterns.map((p) => ({ pattern: p, ok: content.includes(p) }));
}

function checkRegex(content, patterns) {
  return patterns.map((re) => {
    const ok = re.test(content);
    return { pattern: re.toString(), ok };
  });
}

function report(title, results) {
  const allOk = results.every((r) => r.ok);
  console.log(`\n[${allOk ? 'PASS' : 'FAIL'}] ${title}`);
  results.forEach((r) => {
    console.log(` - ${r.ok ? '✔' : '✖'} ${r.pattern}`);
  });
  return allOk;
}

function main() {
  const root = process.cwd();
  const pubPath = path.join(root, 'supabase', 'schema_public.sql');
  const storagePath = path.join(root, 'supabase', 'schema_storage.sql');
  const seedPath = path.join(root, 'supabase', 'migrations', '20251105120003_seed_data.sql');
  const migrationsDir = path.join(root, 'supabase', 'migrations');

  const pub = read(pubPath);
  const storage = read(storagePath);
  const seed = read(seedPath);
  let mig = '';
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    mig = files.map((f) => read(path.join(migrationsDir, f)) || '').join('\n\n');
  } catch (e) {
    // ignore
  }

  let ok = true;

  if (!pub || !storage) {
    console.error('Dumps ausentes. Gere-os com:');
    console.error('  supabase db dump --schema public > supabase/schema_public.sql');
    console.error('  supabase db dump --schema storage > supabase/schema_storage.sql');
    process.exit(1);
  }

  // Checks no schema public
  console.log(`\n[DEBUG] schema_public.sql length: ${pub.length}`);
  console.log(`[DEBUG] schema_storage.sql length: ${storage.length}`);
  console.log(`[DEBUG] migrations.sql length: ${mig.length}`);
  console.log(`[DEBUG] sample schema_public.sql:`, pub.slice(190, 260));
  console.log(`[DEBUG] dashboard_metrics present?`, /CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+"?public"?\.?"?dashboard_metrics"?/i.test(pub));

  // Tabelas essenciais mínimas (schema atual)
  const sourceTables = ((pub || '') + '\n' + (mig || ''));
  ok &= report('Tabelas essenciais (public)', checkRegex(sourceTables, [
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?\.)?"?tenants"?/i,
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?\.)?"?users"?/i,
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?\.)?"?form_definitions"?/i,
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?\.)?"?form_fields"?/i,
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?("?public"?\.)?"?submissions"?/i,
  ]));

  // Funções utilitárias usadas por políticas
  const sourceFuncs = ((pub || '') + '\n' + (mig || ''));
  ok &= report('Funções utilitárias essenciais', checkRegex(sourceFuncs, [
    /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\.?"?user_role"?/i,
    /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\.?"?is_admin_of_tenant"?/i,
  ]));

  // RLS habilitada nas tabelas principais
  const sourceRls = ((pub || '') + '\n' + (mig || ''));
  ok &= report('RLS habilitada (tabelas principais)', checkRegex(sourceRls, [
    /ALTER\s+TABLE\s+("?public"?\.)?"?tenants"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    /ALTER\s+TABLE\s+("?public"?\.)?"?users"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    /ALTER\s+TABLE\s+("?public"?\.)?"?form_definitions"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    /ALTER\s+TABLE\s+("?public"?\.)?"?form_fields"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    /ALTER\s+TABLE\s+("?public"?\.)?"?submissions"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
  ]));

  // Verificação específica desta mudança: enum field_type contém novos valores
  const sourceEnum = (pub && pub.length > 0) ? pub + '\n' + mig : mig;
  ok &= report('ENUM field_type contém novos valores', [
    { pattern: 'field_type::cep', ok: /'cep'/.test(sourceEnum) },
    { pattern: 'field_type::cpf', ok: /'cpf'/.test(sourceEnum) },
    { pattern: 'field_type::radio', ok: /'radio'/.test(sourceEnum) },
  ]);

  // Checagens legadas (não bloqueiam, apenas WARN)
  function reportOptional(title, results) {
    const allOk = results.every((r) => r.ok);
    console.log(`\n[${allOk ? 'PASS' : 'WARN'}] ${title}`);
    results.forEach((r) => {
      console.log(` - ${r.ok ? '✔' : '✖'} ${r.pattern}`);
    });
    return true; // nunca bloqueia
  }

  const sourceLegacy = (pub && pub.length > 0) ? pub : mig;
  reportOptional('Itens legados: message_templates e file_uploads', checkRegex(sourceLegacy, [
    /CREATE\s+TABLE\s+"?public"?\.?"?message_templates"?/i,
    /CREATE\s+TABLE\s+"?public"?\.?"?file_uploads"?/i,
  ]));

  reportOptional('Funções e view legadas', [
    { pattern: 'public.get_file_url', ok: /get_file_url/i.test(pub) },
    { pattern: 'public.dashboard_metrics', ok: /CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+"?public"?\.?"?dashboard_metrics"?/i.test(pub) },
  ]);

  // Storage policies (flexível)
  reportOptional('Storage policies (bucket form-submissions)', [
    { pattern: 'bucket form-submissions', ok: /form\-submissions/i.test(storage) },
    { pattern: 'vínculo com public.file_uploads', ok: /public\.?file_uploads/i.test(storage) },
  ]);

  // Seeds (legado)
  if (seed) {
    const countInserts = (seed.match(/INSERT INTO message_templates/gi) || []).length;
    const seedOk = countInserts >= 3; // mínimo esperado
    console.log(`\n[${seedOk ? 'PASS' : 'WARN'}] Seeds de message_templates`);
    console.log(` - Inserções detectadas: ${countInserts}`);
  } else {
    console.log('\n[WARN] Seed file não encontrado: supabase/migrations/20251105120003_seed_data.sql');
  }

  console.log('\nResumo:');
  console.log(` - Resultado geral: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

main();