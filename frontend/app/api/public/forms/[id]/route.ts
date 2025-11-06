import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

// Preferimos Service Role para evitar bloqueios de RLS na leitura pública de formulários
const admin = createAdminClient();

// GET /api/public/forms/[id] - Buscar formulário público (sem autenticação)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Buscar formulário
    const { data: form, error } = await admin
      .from('form_definitions')
      .select(`
        id,
        slug,
        name,
        description,
        settings,
        tenant_id,
        tenants (
          id,
          name,
          slug
        ),
        form_fields (
          id,
          label,
          name,
          type,
          required,
          placeholder,
          options,
          validation_rules,
          order_index,
          is_active
        )
      `)
      .eq('id', params.id)
      .eq('is_active', true) // Apenas formulários ativos
      .single();

    if (error || !form) {
      return NextResponse.json(
        { error: 'Formulário não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Ordenar campos por order_index
    if (form.form_fields) {
      form.form_fields.sort((a: any, b: any) => a.order_index - b.order_index);
      // Filtrar apenas campos ativos
      form.form_fields = form.form_fields.filter((field: any) => field.is_active !== false);
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error fetching public form:', error);
    return NextResponse.json({ error: 'Erro ao buscar formulário' }, { status: 500 });
  }
}
