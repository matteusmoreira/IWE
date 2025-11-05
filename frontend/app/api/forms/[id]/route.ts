import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/forms/[id] - Buscar formulário por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

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
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Ordenar campos por order_index
    if (form.form_fields) {
      form.form_fields.sort((a: any, b: any) => a.order_index - b.order_index);
    }

    return NextResponse.json({ form });
  } catch (error: any) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/forms/[id] - Atualizar formulário
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { title, description, is_active, settings, fields } = body;

    // Buscar form antigo para auditoria
    const { data: oldForm } = await supabase
      .from('form_definitions')
      .select('*, form_fields(*)')
      .eq('id', params.id)
      .single();

    if (!oldForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verificar se usuário tem acesso ao tenant do form
    if (userData.role !== 'superadmin') {
      const tenantIds = userData.admin_tenants?.map((at: any) => at.tenant_id) || [];
      if (!tenantIds.includes(oldForm.tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Atualizar formulário
    const { data: form, error: updateError } = await supabase
      .from('form_definitions')
      .update({
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(is_active !== undefined && { is_active }),
        ...(settings && { settings }),
      })
      .eq('id', params.id)
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
        .eq('form_definition_id', params.id);

      // Criar novos campos
      if (fields.length > 0) {
        const formFields = fields.map((field: any, index: number) => ({
          form_definition_id: params.id,
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
          return NextResponse.json({ error: fieldsError.message }, { status: 500 });
        }
      }
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'UPDATE',
      resource_type: 'form',
      resource_id: params.id,
      changes: {
        old: oldForm,
        new: { title, description, is_active, settings, fields_count: fields?.length },
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
      .eq('id', params.id)
      .single();

    return NextResponse.json({ form: completeForm });
  } catch (error: any) {
    console.error('Error updating form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/forms/[id] - Deletar formulário
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Buscar form para auditoria e verificação
    const { data: form } = await supabase
      .from('form_definitions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verificar se usuário tem acesso ao tenant do form
    if (userData.role !== 'superadmin') {
      const tenantIds = userData.admin_tenants?.map((at: any) => at.tenant_id) || [];
      if (!tenantIds.includes(form.tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Verificar se há submissões vinculadas
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('id')
      .eq('form_definition_id', params.id)
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
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DELETE',
      resource_type: 'form',
      resource_id: params.id,
      changes: { deleted: form },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
