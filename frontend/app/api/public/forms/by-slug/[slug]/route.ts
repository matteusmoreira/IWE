import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Preferimos Service Role para evitar bloqueios de RLS na leitura pública de formulários
const admin = createAdminClient();

// GET /api/public/forms/by-slug/[slug] - Buscar formulário público por slug (sem autenticação)
export async function GET(
  _request: Request,
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
      const ff = form.form_fields as Array<Record<string, unknown>>;
      ff.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
      form.form_fields = ff.filter((field) => Boolean((field as Record<string, unknown>).is_active ?? true));
    }

    return NextResponse.json({ form });
  } catch (error: unknown) {
    console.error('Error fetching public form by slug:', error);
    return NextResponse.json({ error: 'Erro ao buscar formulário' }, { status: 500 });
  }
}