import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/public/tenants - Lista polos ativos (público)
// Observação: usa Service Role no backend para bypass de RLS e retornar apenas campos seguros.
export async function GET(_request: NextRequest) {
  try {
    const admin = createAdminClient();

    const { data: tenants, error } = await admin
      .from('tenants')
      .select('id, name, slug, status')
      .eq('status', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tenants: tenants || [] });
  } catch (err: any) {
    // Não expomos detalhes sensíveis
    return NextResponse.json({ error: 'Erro ao listar polos' }, { status: 500 });
  }
}