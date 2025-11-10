import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tenants/[id] - Buscar tenant por ID
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error fetching tenant:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/tenants/[id] - Atualizar tenant
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é superadmin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || userData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse do body
    const body = await request.json();
    const { name, slug, status, settings } = body;

    // Buscar tenant antigo para auditoria
    const { data: oldTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', params.id)
      .single();

    // Atualizar tenant
    const { data: tenant, error: updateError } = await supabase
      .from('tenants')
      .update({
        ...(name && { name }),
        ...(slug && { slug }),
        ...(status !== undefined && { status }),
        ...(settings && { settings }),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      tenant_id: params.id,
      user_id: userData.id,
      action: 'UPDATE',
      resource_type: 'tenant',
      resource_id: params.id,
      changes: {
        old: oldTenant,
        new: { name, slug, status, settings },
      },
    });

    return NextResponse.json({ tenant });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error updating tenant:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/tenants/[id] - Deletar tenant
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é superadmin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || userData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar tenant para auditoria
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', params.id)
      .single();

    // Deletar tenant
    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DELETE',
      resource_type: 'tenant',
      resource_id: params.id,
      changes: { deleted: tenant },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error deleting tenant:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
