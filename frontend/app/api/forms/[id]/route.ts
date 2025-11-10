import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/forms/[id] - Buscar formulário por ID
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: form, error } = await supabase
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
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Ordenar campos por order_index
    if (form.form_fields) {
      const ff = form.form_fields as Array<Record<string, unknown>>;
      ff.sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
    }

    return NextResponse.json({ form });
  } catch (error: unknown) {
    console.error('Error fetching form:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/forms/[id] - Atualizar formulário
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

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
    const body = (await request.json()) as Record<string, unknown>;
    const name: string | undefined =
      (typeof body.name === 'string' ? body.name : undefined) ??
      (typeof body.title === 'string' ? body.title : undefined);
    const description = typeof body.description === 'string' ? body.description : undefined;
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : undefined;
    const settings = typeof body.settings === 'object' && body.settings !== null
      ? (body.settings as Record<string, unknown>)
      : undefined;
    const fields = Array.isArray(body.fields) ? body.fields : undefined;
    const tenant_id =
      typeof body.tenant_id === 'string' || typeof body.tenant_id === 'number'
        ? (body.tenant_id as string | number)
        : body.tenant_id === null
        ? null
        : undefined;

    // Buscar form antigo para auditoria
    const { data: oldForm } = await supabase
      .from('form_definitions')
      .select('*, form_fields(*)')
      .eq('id', id)
      .single();

    if (!oldForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verificar se usuário tem acesso ao tenant do form
    if (userData.role !== 'superadmin') {
      const tenantIds = Array.isArray(userData.admin_tenants)
        ? userData.admin_tenants.map((at) => (at as { tenant_id: string | number }).tenant_id)
        : [];
      if (!tenantIds.includes(oldForm.tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Atualizar formulário
    const { error: updateError } = await supabase
      .from('form_definitions')
      .update({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
        ...(settings && { settings }),
        // Permitir alterar tenant apenas para superadmin
        ...(userData.role === 'superadmin' && body.hasOwnProperty('tenant_id')
          ? { tenant_id: tenant_id ?? null }
          : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Atualizar campos se fornecidos
    if (fields !== undefined) {
      // Deletar campos antigos
      await supabase
        .from('form_fields')
        .delete()
        .eq('form_definition_id', id);

      // Criar novos campos
      if (Array.isArray(fields) && fields.length > 0) {
        const formFields = fields.map((field, index: number) => {
          const f = field as Record<string, unknown>;
          const options = Array.isArray(f.options) ? (f.options as unknown[]) : [];
          const validation_rules = typeof f.validation_rules === 'object' && f.validation_rules !== null
            ? (f.validation_rules as Record<string, unknown>)
            : {};
          return {
            form_definition_id: id,
            label: String(f.label ?? ''),
            name: String(f.name ?? ''),
            type: String(f.type ?? ''),
            required: Boolean(f.required ?? false),
            placeholder: (typeof f.placeholder === 'string' ? f.placeholder : null),
            options,
            validation_rules,
            order_index: typeof f.order_index === 'number' ? f.order_index : index,
            is_active: Boolean(f.is_active ?? true),
          };
        });

        const { error: fieldsError } = await supabase
          .from('form_fields')
          .insert(formFields);

        if (fieldsError) {
          return NextResponse.json({ error: fieldsError.message }, { status: 500 });
        }
      }
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'UPDATE',
      resource_type: 'form',
      resource_id: id,
      changes: {
        old: oldForm,
        new: { name, description, is_active, settings, fields_count: fields?.length },
      },
    });

    // Buscar form completo atualizado
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
      .eq('id', id)
      .single();

    return NextResponse.json({ form: completeForm });
  } catch (error: unknown) {
    console.error('Error updating form:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/forms/[id] - Deletar formulário
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

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

    // Buscar form para auditoria e verificação
    const { data: form } = await supabase
      .from('form_definitions')
      .select('*')
      .eq('id', id)
      .single();

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verificar se usuário tem acesso ao tenant do form
    if (userData.role !== 'superadmin') {
      const tenantIds = Array.isArray(userData.admin_tenants)
        ? userData.admin_tenants.map((at) => (at as { tenant_id: string | number }).tenant_id)
        : [];
      if (!tenantIds.includes(form.tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Verificar se há submissões vinculadas
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id')
      .eq('form_definition_id', id)
      .limit(1);

    if (submissions && submissions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete form with existing submissions' },
        { status: 400 }
      );
    }

    // Deletar form (cascade vai deletar os campos)
    const { error: deleteError } = await supabase
      .from('form_definitions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DELETE',
      resource_type: 'form',
      resource_id: id,
      changes: { deleted: form },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting form:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
