import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Preferimos Service Role para evitar bloqueios de RLS na leitura pública de formulários
const admin = createAdminClient();

// GET /api/public/forms/[id] - Buscar formulário público (sem autenticação)
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
      .eq('id', id)
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
      const ff = form.form_fields as Array<Record<string, unknown>>;
      ff.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
      // Filtrar apenas campos ativos
      form.form_fields = ff.filter((field) => Boolean((field as Record<string, unknown>).is_active ?? true)) as typeof form.form_fields;
    }

    return NextResponse.json({ form });
  } catch (error: unknown) {
    console.error('Error fetching public form:', error);
    return NextResponse.json({ error: 'Erro ao buscar formulário' }, { status: 500 });
  }
}
