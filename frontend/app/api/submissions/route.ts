import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Garantir que a rota seja sempre dinâmica (sem cache)
export const dynamic = 'force-dynamic';

// GET /api/submissions - Listar submissões com filtros
export async function GET(request: Request) {
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

    // Obter parâmetros de query
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id');
    const form_id = searchParams.get('form_id');
    const payment_status = searchParams.get('payment_status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query base
    let query = supabase
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
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por tenants se não for superadmin
    if (userData.role !== 'superadmin') {
      const tenantIds = (userData.admin_tenants ?? []).map((at) => (at as { tenant_id: string }).tenant_id);
      if (tenantIds.length === 0) {
        return NextResponse.json({ submissions: [], total: 0 });
      }
      query = query.in('tenant_id', tenantIds);
    }

    // Aplicar filtros
    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }
    if (form_id) {
      query = query.eq('form_definition_id', form_id);
    }
    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    // Busca por texto (nome, e-mail, telefone/whatsapp) e por IDs de aluno/submissão
    if (search) {
      const s = search.trim();

      // Montar lista de clausulas OR
      const orClauses: string[] = [
        `data->>'email'.ilike.*${s}*`,
        `data->>'contato_email'.ilike.*${s}*`,
        `data->>'e-mail'.ilike.*${s}*`,
        `data->>'nome'.ilike.*${s}*`,
        `data->>'nome_completo'.ilike.*${s}*`,
        `data->>'name'.ilike.*${s}*`,
        // variações comuns de nome
        `data->>'aluno'.ilike.*${s}*`,
        `data->>'nome_aluno'.ilike.*${s}*`,
        `data->>'nome_do_aluno'.ilike.*${s}*`,
        `data->>'responsavel_nome'.ilike.*${s}*`,
        `data->>'telefone'.ilike.*${s}*`,
        `data->>'phone'.ilike.*${s}*`,
        `data->>'whatsapp'.ilike.*${s}*`,
        `data->>'celular'.ilike.*${s}*`,
        `data->>'zap'.ilike.*${s}*`,
      ];

      // 1) Buscar por ID da submissão (UUID) quando o termo corresponde a um padrão UUID
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (uuidRegex.test(s)) {
        orClauses.push(`id.eq.${s}`);
      }

      // 2) Buscar por campos de ID do aluno nos formulários
      //    - Candidatos padrão
      const idCandidatesDefault = [
        'id_aluno', 'matricula', 'ra', 'student_id', 'codigo_aluno', 'registro', 'inscricao', 'id'
      ];

      //    - Descobrir dinamicamente nomes de campos que parecem IDs nos formulários
      try {
        const patterns = ['*id*', '*matric*', '*ra*', '*codigo*', '*registro*', '*inscr*'];
        const { data: ff } = await supabase
          .from('form_fields')
          .select('name')
          .or(patterns.map(p => `name.ilike.${p}`).join(','))
          .limit(500);
        const dynamicNames = Array.from(new Set((ff || []).map((r) => String((r as { name: unknown }).name))));
        const idFieldNames = Array.from(new Set([...idCandidatesDefault, ...dynamicNames]));
        for (const fieldName of idFieldNames) {
          // Busca parcial por ID do aluno no JSON
          orClauses.push(`data->>'${fieldName}'.ilike.*${s}*`);
        }

        // 3) Descobrir dinamicamente campos de nome/telefone para ampliar a busca
        const namePhonePatterns = ['*nome*', '*aluno*', '*name*', '*whats*', '*zap*', '*tel*', '*fone*', '*cel*', '*telefone*', '*celular*'];
        const { data: ff2 } = await supabase
          .from('form_fields')
          .select('name')
          .or(namePhonePatterns.map(p => `name.ilike.${p}`).join(','))
          .limit(500);
        const namePhoneNames = Array.from(new Set((ff2 || []).map((r) => String((r as { name: unknown }).name))));
        for (const fieldName of namePhoneNames) {
          orClauses.push(`data->>'${fieldName}'.ilike.*${s}*`);
        }
      } catch {
        // Se não conseguir ler form_fields (RLS), usa somente candidatos padrão
        for (const fieldName of idCandidatesDefault) {
          orClauses.push(`data->>'${fieldName}'.ilike.*${s}*`);
        }
      }

      // Fallback geral: busca em todo o JSON como texto
      orClauses.push(`data::text.ilike.*${s}*`);

      // Aplicar OR acumulado
      query = query.or(orClauses.join(','));
    }

    const { data: submissions, error: submissionsError, count } = await query;

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json({ error: submissionsError.message }, { status: 500 });
    }

    return NextResponse.json({
      submissions: submissions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Error in submissions GET:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
