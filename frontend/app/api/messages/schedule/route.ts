import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const tenant_id = typeof raw.tenant_id === 'string' ? raw.tenant_id : null;
    const channel = typeof raw.channel === 'string' && (raw.channel === 'whatsapp' || raw.channel === 'email')
      ? (raw.channel as 'whatsapp' | 'email')
      : null;
    const scheduled_for = typeof raw.scheduled_for === 'string' ? raw.scheduled_for : null;
    if (!tenant_id || !channel || !scheduled_for) {
      return NextResponse.json({ error: 'tenant_id, channel e scheduled_for são obrigatórios' }, { status: 400 });
    }

    // Verifica usuário
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();
    if (userErr || !userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Monta dados do job
    const baseMetadata: Record<string, unknown> = {
      channel,
      template_key: typeof raw.template_key === 'string' ? raw.template_key : null,
      variables: (typeof raw.variables === 'object' && raw.variables !== null) ? raw.variables as Record<string, unknown> : {},
      ...((typeof raw.metadata === 'object' && raw.metadata !== null) ? raw.metadata as Record<string, unknown> : {}),
    };

    // recipient_phones não pode ser null; usar [] para e-mail
    const recipient_phones = channel === 'whatsapp'
      ? (Array.isArray(raw.recipient_phones) ? (raw.recipient_phones as unknown[]).map(v => String(v)) : [])
      : [];

    const insertPayload: Record<string, unknown> = {
      tenant_id,
      template_id: null,
      recipient_phones,
      scheduled_for,
      status: 'PENDING',
      metadata: {
        ...baseMetadata,
        to: Array.isArray(raw.to) ? (raw.to as unknown[]).map(v => String(v)) : undefined,
        subject: typeof raw.subject === 'string' ? raw.subject : undefined,
        html: typeof raw.html === 'string' ? raw.html : undefined,
        message: typeof raw.message === 'string' ? raw.message : undefined,
      },
      created_by: userRow.id,
    };

    const { data: job, error: insertError } = await supabase
      .from('schedule_jobs')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Auditoria mínima
    await supabase.from('audit_logs').insert({
      tenant_id,
      user_id: userRow.id,
      action: 'CREATE',
      resource_type: 'schedule_job',
      resource_id: job.id,
      changes: { channel, scheduled_for, metadata: insertPayload.metadata, recipient_phones_count: recipient_phones.length },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: unknown) {
    console.error('Schedule error:', error);
    return NextResponse.json({ error: 'Falha ao agendar' }, { status: 500 });
  }
}