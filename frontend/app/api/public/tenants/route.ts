import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Lista pública de polos/tenants para páginas de formulário sem autenticação.
// Segurança: expõe apenas id, name e slug de tenants ativos (status=true).
const admin = createAdminClient();

// GET /api/public/tenants
export async function GET() {
  try {
    const { data: tenants, error } = await admin
      .from('tenants')
      .select('id, name, slug, status')
      .eq('status', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Não expor o campo status no payload final (apenas usado para filtro)
    const safeTenants = Array.isArray(tenants)
      ? tenants.map((t) => {
          const tr = t as { id?: unknown; name?: unknown; slug?: unknown };
          return {
            id: tr.id ?? null,
            name: typeof tr.name === 'string' ? tr.name : String(tr.name ?? ''),
            slug: typeof tr.slug === 'string' ? tr.slug : String(tr.slug ?? ''),
          };
        })
      : [];
    return NextResponse.json({ tenants: safeTenants });
  } catch (error: unknown) {
    console.error('Error fetching public tenants:', error);
    return NextResponse.json({ error: 'Erro ao listar polos' }, { status: 500 });
  }
}