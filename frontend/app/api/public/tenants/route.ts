import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Lista pública de polos/tenants para páginas de formulário sem autenticação.
// Segurança: expõe apenas id, name e slug de tenants ativos (status=true).
const admin = createAdminClient();

// GET /api/public/tenants
export async function GET(_request: NextRequest) {
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
    const safeTenants = (tenants || []).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug }));
    return NextResponse.json({ tenants: safeTenants });
  } catch (error: any) {
    console.error('Error fetching public tenants:', error);
    return NextResponse.json({ error: 'Erro ao listar polos' }, { status: 500 });
  }
}