import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Preferimos Service Role para evitar bloqueios de RLS na leitura pública de formulários
const admin = createAdminClient();

// GET /api/public/forms/by-slug/[slug] - Buscar formulário público por slug (sem autenticação)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;

    // Buscar formulário por slug
    const { data: form, error } = await admin
      .from('form_definitions')
      .select(`
        id,
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
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !form) {
      return NextResponse.json(
        { error: 'Formulário não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Ordenar campos por order_index e filtrar ativos
    if (form.form_fields) {
      form.form_fields.sort((a: any, b: any) => a.order_index - b.order_index);
      form.form_fields = form.form_fields.filter((field: any) => field.is_active !== false);
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error fetching public form by slug:', error);
    return NextResponse.json({ error: 'Erro ao buscar formulário' }, { status: 500 });
  }
}