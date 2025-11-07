import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('path');
    const format = searchParams.get('format');
    if (!storagePath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.storage
      .from('form-submissions')
      .createSignedUrl(storagePath, 60 * 60 * 2); // 2 horas por padrão

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Failed to get signed url' }, { status: 500 });
    }

    if (format === 'json') {
      return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 });
    }

    return NextResponse.redirect(data.signedUrl, { status: 302 });
  } catch (err) {
    console.error('Signed URL route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}