import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const rawSlug = url.searchParams.get('slug') || '';
    const tenantParam = url.searchParams.get('tenant_id');
    const excludeId = url.searchParams.get('exclude_id') || undefined;

    const slug = slugify(rawSlug);
    if (!slug) {
      return NextResponse.json({ available: false, slug: '' });
    }

    let query = supabase
      .from('form_definitions')
      .select('id')
      .eq('slug', slug);

    if (tenantParam && tenantParam !== 'null' && tenantParam !== '') {
      query = query.eq('tenant_id', tenantParam);
    } else {
      query = query.is('tenant_id', null);
    }

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data } = await query.limit(1);
    const available = !(data && data.length > 0);
    return NextResponse.json({ available, slug });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}