import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

// GET /api/forms - Listar todos os formulários
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar usuário e verificar role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, admin_tenants(tenant_id)')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Query base
    let query = supabase
      .from('form_definitions')
      .select(`
        *,
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
      .order('created_at', { ascending: false });

    // Filtrar por tenants se não for superadmin
    if (userData.role !== 'superadmin') {
      const tenantIds = userData.admin_tenants?.map((at: any) => at.tenant_id) || [];
      if (tenantIds.length === 0) {
        // Admin sem polos: ainda pode ver formulários globais
        query = query.is('tenant_id', null);
      } else {
        // Incluir formulários globais e dos polos administrados
        query = query.or(`tenant_id.is.null,tenant_id.in.(${tenantIds.join(',')})`);
      }
    }

    const { data: forms, error: formsError } = await query;

    if (formsError) {
      return NextResponse.json({ error: formsError.message }, { status: 500 });
    }

    // Ordenar campos por order_index
    const formsWithSortedFields = forms?.map(form => ({
      ...form,
      form_fields: form.form_fields?.sort((a: any, b: any) => a.order_index - b.order_index) || []
    }));

    return NextResponse.json({ forms: formsWithSortedFields });
  } catch (error: any) {
    console.error('Error fetching forms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/forms - Criar novo formulário
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, admin_tenants(tenant_id)')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse do body
    const body = await request.json();
    const { tenant_id, description, is_active, settings, fields } = body;
    const name: string | undefined = body.name ?? body.title;

    // Validações
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    // Verificar se usuário tem acesso ao tenant
    if (userData.role !== 'superadmin') {
      // Admin deve informar um tenant válido
      const tenantIds = userData.admin_tenants?.map((at: any) => at.tenant_id) || [];
      if (!tenant_id) {
        return NextResponse.json({ error: 'Admins devem selecionar um polo' }, { status: 400 });
      }
      if (!tenantIds.includes(tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Gerar slug único por tenant
    const baseSlug = slugify(name);
    let slugCandidate = baseSlug;

    // Fallback seguro caso o título gere slug vazio
    if (!slugCandidate) {
      slugCandidate = `form-${Math.random().toString(36).slice(2, 8)}`;
    }

    // Buscar slugs existentes que começam com o baseSlug para evitar colisão
    let existingSlugs: any[] = [];
    if (tenant_id) {
      const { data } = await supabase
        .from('form_definitions')
        .select('slug')
        .eq('tenant_id', tenant_id)
        .ilike('slug', `${baseSlug}%`);
      existingSlugs = data || [];
    } else {
      // Formulário global: checar slugs globais (tenant_id IS NULL)
      const { data } = await supabase
        .from('form_definitions')
        .select('slug')
        .is('tenant_id', null)
        .ilike('slug', `${baseSlug}%`);
      existingSlugs = data || [];
    }

    if (existingSlugs && existingSlugs.length > 0) {
      const used = new Set(existingSlugs.map((r: any) => r.slug));
      if (used.has(slugCandidate)) {
        let i = 2;
        while (used.has(`${baseSlug}-${i}`)) i++;
        slugCandidate = `${baseSlug}-${i}`;
      }
    }

    // Criar formulário com slug
    const { data: form, error: formError } = await supabase
      .from('form_definitions')
      .insert({
        tenant_id,
        name,
        slug: slugCandidate,
        description: description || null,
        is_active: is_active ?? true,
        settings: settings || {},
      })
      .select()
      .single();

    if (formError) {
      return NextResponse.json({ error: formError.message }, { status: 500 });
    }

    // Criar campos se fornecidos
    if (fields && fields.length > 0) {
      const formFields = fields.map((field: any, index: number) => ({
        form_definition_id: form.id,
        label: field.label,
        name: field.name,
        type: field.type,
        required: field.required ?? false,
        placeholder: field.placeholder || null,
        options: field.options || [],
        validation_rules: field.validation_rules || {},
        order_index: field.order_index ?? index,
        is_active: field.is_active ?? true,
      }));

      const { error: fieldsError } = await supabase
        .from('form_fields')
        .insert(formFields);

      if (fieldsError) {
        // Rollback: deletar o form
        await supabase.from('form_definitions').delete().eq('id', form.id);
        return NextResponse.json({ error: fieldsError.message }, { status: 500 });
      }
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'CREATE',
      resource_type: 'form',
      resource_id: form.id,
      changes: { name, description, tenant_id, fields_count: fields?.length || 0 },
    });

    // Buscar form completo com campos
    const { data: completeForm } = await supabase
      .from('form_definitions')
      .select(`
        *,
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
      .eq('id', form.id)
      .single();

    return NextResponse.json({ form: completeForm }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
