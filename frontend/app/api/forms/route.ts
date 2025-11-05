import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/forms - Listar todos os formulários
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

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
        return NextResponse.json({ forms: [] });
      }
      query = query.in('tenant_id', tenantIds);
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
    const supabase = createRouteHandlerClient({ cookies });

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
    const { tenant_id, title, description, is_active, settings, fields } = body;

    // Validações
    if (!tenant_id || !title) {
      return NextResponse.json({ error: 'Tenant and title are required' }, { status: 400 });
    }

    // Verificar se usuário tem acesso ao tenant
    if (userData.role !== 'superadmin') {
      const tenantIds = userData.admin_tenants?.map((at: any) => at.tenant_id) || [];
      if (!tenantIds.includes(tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Criar formulário
    const { data: form, error: formError } = await supabase
      .from('form_definitions')
      .insert({
        tenant_id,
        title,
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
      changes: { title, description, tenant_id, fields_count: fields?.length || 0 },
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
