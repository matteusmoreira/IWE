import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ScheduleBody = {
  tenant_id: string;
  channel: 'whatsapp' | 'email';
  scheduled_for: string; // ISO string
  recipient_phones?: string[];
  to?: string[];
  template_key?: string;
  message?: string;
  subject?: string;
  html?: string;
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ScheduleBody = await request.json();
    const { tenant_id, channel, scheduled_for } = body;
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
    const baseMetadata = {
      channel,
      template_key: body.template_key || null,
      variables: body.variables || {},
      ...(body.metadata || {}),
    };

    // recipient_phones não pode ser null; usar [] para e-mail
    const recipient_phones = channel === 'whatsapp' ? (body.recipient_phones || []) : [];

    const insertPayload: any = {
      tenant_id,
      template_id: null,
      recipient_phones,
      scheduled_for,
      status: 'PENDING',
      metadata: {
        ...baseMetadata,
        to: body.to || undefined,
        subject: body.subject || undefined,
        html: body.html || undefined,
        message: body.message || undefined,
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
  } catch (error: any) {
    console.error('Schedule error:', error);
    return NextResponse.json({ error: 'Falha ao agendar' }, { status: 500 });
  }
}