import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/admins - Listar todos os admins
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

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
    // Usar adminClient (service role) para ler admin_tenants, evitando bloqueios de RLS
    const { data: admins, error: adminsError } = await adminClient
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admins - Criar novo admin
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

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

    // Criar usuário no auth.users usando admin API (service role)
    const { data: authUser, error: createAuthError } = await adminClient.auth.admin.createUser({
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
    const { data: newUser, error: createUserError } = await adminClient
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
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: createUserError.message }, { status: 500 });
    }

    // Vincular a tenants se fornecido
    if (tenant_ids && tenant_ids.length > 0) {
      const adminTenants = tenant_ids.map((tenant_id: string) => ({
        user_id: newUser.id,
        tenant_id,
      }));

      const { error: linkError } = await adminClient
        .from('admin_tenants')
        .insert(adminTenants);

      if (linkError) {
        console.error('Error linking tenants:', linkError);
      }
    }

    // Registrar auditoria
    await adminClient.from('audit_logs').insert({
      user_id: userData.id,
      action: 'CREATE',
      resource_type: 'admin',
      resource_id: newUser.id,
      changes: { email, name, role, tenant_ids },
    });

    return NextResponse.json({ admin: newUser }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
