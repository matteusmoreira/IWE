import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/admins/[id] - Buscar admin por ID
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: admin, error } = await supabase
      .from('users')
      .select(`
        *,
        admin_tenants (
          tenant_id,
          tenants (
            id,
            name,
            slug
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ admin });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching admin:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/admins/[id] - Atualizar admin
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { id } = params;

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
    const { name, phone, role, is_active, tenant_ids } = body;

    // Buscar admin antigo
    // Buscar admin antigo (usar Service Role para evitar bloqueios de RLS)
    const { data: oldAdmin } = await adminClient
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    // Atualizar admin
    const { data: adminRows, error: updateError } = await adminClient
      .from('users')
      .update({
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq('id', id)
      .select();

    const admin = Array.isArray(adminRows) ? adminRows[0] : adminRows;

    if (updateError) {
      console.error('Error updating users row:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Atualizar vinculação com tenants se fornecido
    if (tenant_ids !== undefined) {
      // Remover vinculações antigas
      const { error: delLinkError } = await adminClient
        .from('admin_tenants')
        .delete()
        .eq('user_id', id);
      if (delLinkError) {
        console.error('Error deleting admin_tenants links:', delLinkError);
        return NextResponse.json({ error: delLinkError.message }, { status: 500 });
      }

      // Criar novas vinculações
      if (Array.isArray(tenant_ids) && tenant_ids.length > 0) {
        const adminTenants = tenant_ids.map((tenant_id: string) => ({
          user_id: id,
          tenant_id,
        }));

        const { error: insertLinkError } = await adminClient
          .from('admin_tenants')
          .insert(adminTenants);
        if (insertLinkError) {
          console.error('Error inserting admin_tenants links:', insertLinkError);
          return NextResponse.json({ error: insertLinkError.message }, { status: 500 });
        }
      }
    }

    // Registrar auditoria
    await adminClient.from('audit_logs').insert({
      user_id: userData.id,
      action: 'UPDATE',
      resource_type: 'admin',
      resource_id: id,
      changes: {
        old: oldAdmin,
        new: { name, phone, role, is_active, tenant_ids },
      },
    });

    return NextResponse.json({ admin });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admins/[id] - Deletar admin
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { id } = params;

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

    // Buscar admin para auditoria
    const { data: admin } = await supabase
      .from('users')
      .select('*, auth_user_id')
      .eq('id', id)
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Não permitir deletar a si mesmo
    if (admin.auth_user_id === user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    // Deletar do auth.users (cascade vai deletar da tabela users)
    if (admin.auth_user_id) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(admin.auth_user_id);
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError);
      }
    }

    // Deletar da tabela users (se ainda não foi deletado por cascade)
    const { error: deleteUserError } = await adminClient
      .from('users')
      .delete()
      .eq('id', id);
    if (deleteUserError) {
      console.error('Error deleting users row:', deleteUserError);
    }

    // Registrar auditoria
    const { error: auditError } = await adminClient.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DELETE',
      resource_type: 'admin',
      resource_id: id,
      changes: { deleted: admin },
    });
    if (auditError) {
      console.error('Error writing audit log:', auditError);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
