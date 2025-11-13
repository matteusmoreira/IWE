import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, admin_tenants(tenant_id)')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: sourceForm, error: sourceError } = await supabase
      .from('form_definitions')
      .select('*, form_fields(*)')
      .eq('id', id)
      .single();

    if (sourceError || !sourceForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (userData.role !== 'superadmin') {
      const tenantIds = Array.isArray(userData.admin_tenants)
        ? userData.admin_tenants.map((at) => (at as { tenant_id: string | number }).tenant_id)
        : [];
      if (!sourceForm.tenant_id || !tenantIds.includes(sourceForm.tenant_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const targetTenantId = sourceForm.tenant_id ?? null;
    const newName = `${String(sourceForm.name)} (Cópia)`;

    const baseSlug = slugify(newName);
    let slugCandidate = baseSlug || `form-${Math.random().toString(36).slice(2, 8)}`;

    let existingSlugs: Array<{ slug?: string }> = [];
    if (targetTenantId) {
      const { data } = await supabase
        .from('form_definitions')
        .select('slug')
        .eq('tenant_id', targetTenantId)
        .ilike('slug', `${baseSlug}%`);
      existingSlugs = data || [];
    } else {
      const { data } = await supabase
        .from('form_definitions')
        .select('slug')
        .is('tenant_id', null)
        .ilike('slug', `${baseSlug}%`);
      existingSlugs = data || [];
    }

    if (existingSlugs && existingSlugs.length > 0) {
      const used = new Set(existingSlugs.map((r) => String(r.slug ?? '')));
      if (used.has(slugCandidate)) {
        let i = 2;
        while (used.has(`${baseSlug}-${i}`)) i++;
        slugCandidate = `${baseSlug}-${i}`;
      }
    }

    const { data: newForm, error: insertError } = await supabase
      .from('form_definitions')
      .insert({
        tenant_id: targetTenantId,
        name: newName,
        slug: slugCandidate,
        description: sourceForm.description || null,
        redirect_url_after_flow: sourceForm.redirect_url_after_flow || null,
        is_active: sourceForm.is_active ?? true,
        settings: sourceForm.settings || {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const fieldsToInsert = Array.isArray(sourceForm.form_fields)
      ? (sourceForm.form_fields as Array<Record<string, unknown>>).map((f) => {
          const options = Array.isArray((f as Record<string, unknown>).options)
            ? ((f as Record<string, unknown>).options as unknown[])
            : [];
          const validation_rules = typeof (f as Record<string, unknown>).validation_rules === 'object' && (f as Record<string, unknown>).validation_rules !== null
            ? ((f as Record<string, unknown>).validation_rules as Record<string, unknown>)
            : {};
          return {
            form_definition_id: newForm.id,
            label: String((f as Record<string, unknown>).label ?? ''),
            name: String((f as Record<string, unknown>).name ?? ''),
            type: String((f as Record<string, unknown>).type ?? ''),
            required: Boolean((f as Record<string, unknown>).required ?? false),
            placeholder: (typeof (f as Record<string, unknown>).placeholder === 'string' ? (f as Record<string, unknown>).placeholder : null),
            options,
            validation_rules,
            order_index: typeof (f as Record<string, unknown>).order_index === 'number' ? (f as Record<string, unknown>).order_index : 0,
            is_active: Boolean((f as Record<string, unknown>).is_active ?? true),
          };
        })
      : [];

    if (fieldsToInsert.length > 0) {
      const { error: fieldsError } = await supabase
        .from('form_fields')
        .insert(fieldsToInsert);

      if (fieldsError) {
        await supabase.from('form_definitions').delete().eq('id', newForm.id);
        return NextResponse.json({ error: fieldsError.message }, { status: 500 });
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'DUPLICATE',
      resource_type: 'form',
      resource_id: newForm.id,
      changes: { from: sourceForm.id, name: newName },
    });

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
      .eq('id', newForm.id)
      .single();

    return NextResponse.json({ form: completeForm }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}