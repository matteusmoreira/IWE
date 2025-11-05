import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/admins - Listar todos os admins
export async function GET(request: NextRequest) {
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
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || userData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar admins com seus tenants
    const { data: admins, error: adminsError } = await supabase
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
      .in('role', ['admin', 'superadmin'])
      .order('created_at', { ascending: false });

    if (adminsError) {
      return NextResponse.json({ error: adminsError.message }, { status: 500 });
    }

    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admins - Criar novo admin
export async function POST(request: NextRequest) {
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
    const { email, name, phone, role, password, tenant_ids } = body;

    // Validações
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Email, name and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Criar usuário no auth.users usando admin API
    const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    if (createAuthError) {
      return NextResponse.json({ error: createAuthError.message }, { status: 500 });
    }

    // Criar registro na tabela users
    const { data: newUser, error: createUserError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.user.id,
        email,
        name,
        phone: phone || null,
        role: role || 'admin',
        is_active: true,
      })
      .select()
      .single();

    if (createUserError) {
      // Se falhar, deletar o usuário do auth
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: createUserError.message }, { status: 500 });
    }

    // Vincular a tenants se fornecido
    if (tenant_ids && tenant_ids.length > 0) {
      const adminTenants = tenant_ids.map((tenant_id: string) => ({
        user_id: newUser.id,
        tenant_id,
      }));

      const { error: linkError } = await supabase
        .from('admin_tenants')
        .insert(adminTenants);

      if (linkError) {
        console.error('Error linking tenants:', linkError);
      }
    }

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'CREATE',
      resource_type: 'admin',
      resource_id: newUser.id,
      changes: { email, name, role, tenant_ids },
    });

    return NextResponse.json({ admin: newUser }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
