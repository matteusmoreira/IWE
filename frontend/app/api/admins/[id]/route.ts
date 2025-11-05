import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/admins/[id] - Buscar admin por ID
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
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ admin });
  } catch (error: any) {
    console.error('Error fetching admin:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admins/[id] - Atualizar admin
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
    const { data: oldAdmin } = await supabase
      .from('users')
      .select('*')
      .eq('id', params.id)
      .single();

    // Atualizar admin
    const { data: admin, error: updateError } = await supabase
      .from('users')
      .update({
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Atualizar vinculação com tenants se fornecido
    if (tenant_ids !== undefined) {
      // Remover vinculações antigas
      await supabase
        .from('admin_tenants')
        .delete()
        .eq('user_id', params.id);

      // Criar novas vinculações
      if (tenant_ids.length > 0) {
        const adminTenants = tenant_ids.map((tenant_id: string) => ({
          user_id: params.id,
          tenant_id,
        }));

        await supabase
          .from('admin_tenants')
          .insert(adminTenants);
      }
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'UPDATE',
      resource_type: 'admin',
      resource_id: params.id,
      changes: {
        old: oldAdmin,
        new: { name, phone, role, is_active, tenant_ids },
      },
    });

    return NextResponse.json({ admin });
  } catch (error: any) {
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admins/[id] - Deletar admin
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
      .eq('id', params.id)
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
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(admin.auth_user_id);
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError);
      }
    }

    // Deletar da tabela users (se ainda não foi deletado por cascade)
    await supabase
      .from('users')
      .delete()
      .eq('id', params.id);

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DELETE',
      resource_type: 'admin',
      resource_id: params.id,
      changes: { deleted: admin },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
