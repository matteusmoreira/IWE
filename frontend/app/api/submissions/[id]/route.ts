import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Evitar qualquer cache para este handler
export const dynamic = 'force-dynamic';

// GET /api/submissions/[id] - Buscar submissão por ID
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

    const { data: submission, error } = await supabase
      .from('submissions')
      .select(`
        *,
        tenants (
          id,
          name,
          slug
        ),
        form_definitions (
          id,
          name,
          form_fields (
            id,
            label,
            name,
            type
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ submission });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error fetching submission:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/submissions/[id] - Atualizar submissão
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
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse do body
    const body = await request.json();
    const { payment_status, data: formData, metadata } = body;

    // Buscar submission antiga para auditoria
    const { data: oldSubmission } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldSubmission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Atualizar submissão com regras de permissão
    const updateData: { payment_status?: string; data?: unknown; metadata?: Record<string, unknown> } = {};

    // 1) Atualização manual de status de pagamento:
    // Permitido apenas para SUPERADMIN ou ADMIN; caso contrário, retorna 403.
    if (typeof payment_status !== 'undefined') {
      const allowedRoles = ['SUPERADMIN', 'ADMIN'];
      if (!allowedRoles.includes(userData.role)) {
        return NextResponse.json({ error: 'Forbidden: you are not allowed to change payment status manually' }, { status: 403 });
      }
      updateData.payment_status = payment_status;
    }

    // 2) Atualizações de dados do formulário (sempre permitidas para usuário autenticado, respeitando RLS existente)
    if (typeof formData !== 'undefined') {
      updateData.data = formData;
    }

    // 3) Merge de metadados
    if (typeof metadata === 'object' && metadata !== null) {
      updateData.metadata = { ...(oldSubmission.metadata || {}), ...metadata };
    }

    // Nenhuma alteração enviada
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: submission, error: updateError } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Registrar auditoria (guarda o diff solicitado, sem expor segredos)
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'UPDATE',
      resource_type: 'submission',
      resource_id: id,
      changes: {
        old: oldSubmission,
        new: updateData,
      },
    });

    return NextResponse.json({ submission });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error updating submission:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/submissions/[id] - Deletar submissão
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
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Buscar submission para auditoria
    const { data: submission } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Deletar (não depender de retorno de linhas, pois RLS pode impedir returning)
    const { error: deleteError } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DELETE',
      resource_type: 'submission',
      resource_id: id,
      changes: { deleted: submission },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error deleting submission:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
