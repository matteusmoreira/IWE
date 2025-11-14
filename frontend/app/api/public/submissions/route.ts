import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateFormData } from '@/lib/validation';

// Cliente público do Supabase removido (não utilizado neste endpoint)

// POST /api/public/submissions - Criar nova submissão (público)
export async function POST(request: Request) {
  try {
    // Rate limiting para proteção contra spam
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }
    
    const body = (await request.json()) as Record<string, unknown>;
    
    // Validar e sanitizar dados de entrada
    const form_id = (typeof body.form_id === 'string' || typeof body.form_id === 'number') ? body.form_id : null;
    const rawFormData = (typeof body.data === 'object' && body.data !== null) ? (body.data as Record<string, unknown>) : null;
    const tenant_id = (typeof body.tenant_id === 'string' || typeof body.tenant_id === 'number') ? body.tenant_id : null;
    
    // Sanitizar dados do formulário
    const formData = rawFormData ? validateFormData(rawFormData) : null;

    if (!form_id || !formData) {
      return NextResponse.json(
        { error: 'form_id e data são obrigatórios' },
        { status: 400 }
      );
    }

    // Nota: tenant_id pode ser opcional quando o formulário possui tenant vinculado

    // Buscar formulário para validar (usar Service Role para evitar bloqueios de RLS)
    const admin = createAdminClient();
    const { data: form, error: formError } = await admin
      .from('form_definitions')
      .select(`
        id,
        tenant_id,
        is_active,
        settings,
        form_fields (
          id,
          name,
          type,
          required,
          validation_rules
        )
      `)
      .eq('id', form_id)
      .single();

    if (formError || !form || !form.is_active) {
      return NextResponse.json(
        { error: 'Formulário não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Validar e resolver tenant da submissão
    // Reutilizar admin client já criado para validar tenant
    let tenantToUse: { id: string | number; name: string; status: boolean } | null = null;

    if (form.tenant_id) {
      // Formulário vinculado a um polo específico: deve usar o mesmo polo
      // Se body.tenant_id vier e for diferente, rejeitar
      if (tenant_id && tenant_id !== form.tenant_id) {
        return NextResponse.json(
          { error: 'Polo selecionado não corresponde ao polo do formulário' },
          { status: 400 }
        );
      }

      const { data: fixedTenant, error: fixedTenantError } = await admin
        .from('tenants')
        .select('id, name, status')
        .eq('id', form.tenant_id)
        .single();

      if (fixedTenantError || !fixedTenant) {
        return NextResponse.json(
          { error: 'Polo do formulário inválido' },
          { status: 400 }
        );
      }
      if (fixedTenant.status !== true) {
        return NextResponse.json(
          { error: 'Polo do formulário está inativo' },
          { status: 400 }
        );
      }
      tenantToUse = {
        id: fixedTenant.id,
        name: fixedTenant.name,
        status: fixedTenant.status === true,
      };
    } else {
      // Formulário global: tenant_id é obrigatório
      if (!tenant_id) {
        return NextResponse.json(
          { error: 'tenant_id é obrigatório para este formulário. Selecione um polo.' },
          { status: 400 }
        );
      }

      const { data: selectedTenant, error: tenantError } = await admin
        .from('tenants')
        .select('id, name, status')
        .eq('id', tenant_id)
        .single();

      if (tenantError || !selectedTenant) {
        return NextResponse.json(
          { error: 'Polo inválido' },
          { status: 400 }
        );
      }
      if (selectedTenant.status !== true) {
        return NextResponse.json(
          { error: 'Polo inativo. Escolha outro polo.' },
          { status: 400 }
        );
      }
      tenantToUse = {
        id: selectedTenant.id,
        name: selectedTenant.name,
        status: selectedTenant.status === true,
      };
    }

    // Validar campos obrigatórios
    const fields = Array.isArray(form.form_fields) ? (form.form_fields as Array<Record<string, unknown>>) : [];
    const requiredFields = fields.filter((f) => Boolean(f.required));
    const missingFields = requiredFields.filter((f) => {
      const fname = String(f.name ?? '').trim();
      const val = formData ? formData[fname] : undefined;
      return val === undefined || val === null || String(val) === '';
    });

    if (missingFields && missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Campos obrigatórios não preenchidos',
          missing_fields: missingFields.map((f) => String(f.name ?? '')),
        },
        { status: 400 }
      );
    }

    // Validar tipos de dados
    for (const fieldRaw of fields) {
      const fname = String(fieldRaw.name ?? '').trim();
      const value = formData ? formData[fname] : undefined;
      const type = String(fieldRaw.type ?? '').toLowerCase();
      const vr = (typeof fieldRaw.validation_rules === 'object' && fieldRaw.validation_rules !== null)
        ? (fieldRaw.validation_rules as Record<string, unknown>)
        : {};
      
      if (!value) continue; // Pula se não foi preenchido (já validamos required acima)

      // Validação de email
      if (type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          return NextResponse.json(
            { error: `Campo ${fname} deve ser um email válido` },
            { status: 400 }
          );
        }
      }

      // Validação de CPF (formato básico)
      if (type === 'cpf' && value) {
        const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
        if (!cpfRegex.test(String(value))) {
          return NextResponse.json(
            { error: `Campo ${fname} deve ser um CPF válido (000.000.000-00)` },
            { status: 400 }
          );
        }
      }

      // Validação de CEP
      if (type === 'cep' && value) {
        const cepRegex = /^\d{5}-\d{3}$/;
        if (!cepRegex.test(String(value))) {
          return NextResponse.json(
            { error: `Campo ${fname} deve ser um CEP válido (00000-000)` },
            { status: 400 }
          );
        }
      }

      // Validação de número
      if (type === 'number' && value) {
        const numVal = Number(value);
        if (Number.isNaN(numVal)) {
          return NextResponse.json(
            { error: `Campo ${fname} deve ser um número` },
            { status: 400 }
          );
        }

        // Validar min/max se definidos
        if (vr.min !== undefined) {
          if (numVal < Number(vr.min)) {
            return NextResponse.json(
              { error: `Campo ${fname} deve ser no mínimo ${vr.min}` },
              { status: 400 }
            );
          }
        }
        if (vr.max !== undefined) {
          if (numVal > Number(vr.max)) {
            return NextResponse.json(
              { error: `Campo ${fname} deve ser no máximo ${vr.max}` },
              { status: 400 }
            );
          }
        }
      }

      // Validação de comprimento de texto
      if ((type === 'text' || type === 'textarea') && value) {
        const strVal = String(value);
        const minLen = (vr.minLength !== undefined ? Number(vr.minLength) : undefined);
        const maxLen = (vr.maxLength !== undefined ? Number(vr.maxLength) : undefined);
        if (minLen !== undefined && strVal.length < minLen) {
          return NextResponse.json(
            { error: `Campo ${fname} deve ter no mínimo ${minLen} caracteres` },
            { status: 400 }
          );
        }
        if (maxLen !== undefined && strVal.length > maxLen) {
          return NextResponse.json(
            { error: `Campo ${fname} deve ter no máximo ${maxLen} caracteres` },
            { status: 400 }
          );
        }
      }
    }

    // Verificação de duplicidade: Nome + CPF
    // - Identifica dinamicamente os campos de nome e cpf do formulário
    // - Bloqueia nova submissão quando já existir registro com mesmo CPF
    //   (e opcionalmente mesmo nome) em qualquer formulário do sistema.
    const cpfField = fields.find((f) => String(f.type ?? '').toLowerCase() === 'cpf')?.name as string | undefined;
    const nameField = fields.find((f) => {
      const n = String(f.name ?? '').toLowerCase();
      return ['nome_completo', 'nome', 'name'].includes(n);
    })?.name as string | undefined;

    const cpfValueRaw = cpfField ? formData[cpfField] : null;
    const nameValueRaw = nameField ? formData[nameField] : null;

    if (cpfValueRaw) {
      // Busca por CPF exatamente igual (formato mascarado). Como o frontend aplica máscara,
      // isso evita falsos negativos por diferenças de formatação.
      // Se também houver nome, exige ambos para reduzir falso-positivo em casos raros.
      let dupQuery = admin
        .from('submissions')
        .select('id, payment_status, created_at')
        .eq(`data->>${cpfField}`, cpfValueRaw)
        .order('created_at', { ascending: false })
        .limit(1);

      if (nameValueRaw) {
        dupQuery = dupQuery.eq(`data->>${nameField}`, nameValueRaw);
      }

      const { data: dup, error: dupError } = await dupQuery;
      if (dupError) {
        console.error('Erro ao verificar duplicidade:', dupError);
        // Prossegue sem bloquear se houver erro de verificação
      } else if (dup && dup.length > 0) {
        const last = dup[0] as { id: string; payment_status?: string };
        if (last.payment_status && last.payment_status !== 'PENDENTE') {
          return NextResponse.json(
            { error: 'Aluno já cadastrado no sistema!' },
            { status: 409 }
          );
        }
      }
    }

    // Capturar informações da requisição
    // Extrair primeiro IP válido
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const firstForwardedIp = forwardedFor.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip') || '';
    const ipCandidate = firstForwardedIp || realIp || '';
    const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;
    const ip = ipCandidate && (ipv4Regex.test(ipCandidate) || ipv6Regex.test(ipCandidate)) ? ipCandidate : null;
    const userAgent = request.headers.get('user-agent') || null;

    // Criar submissão
    const settings = (typeof form.settings === 'object' && form.settings !== null)
      ? (form.settings as Record<string, unknown>)
      : {};
    const require_payment = Boolean((settings as Record<string, unknown>).require_payment ?? false);
    const payment_amount = Number((settings as Record<string, unknown>).payment_amount ?? 0);
    const form_title = typeof (settings as Record<string, unknown>).form_title === 'string'
      ? (settings as Record<string, unknown>).form_title as string
      : 'Formulário';

    const { data: submission, error: submissionError } = await admin
      .from('submissions')
      .insert({
        tenant_id: tenantToUse!.id,
        polo: tenantToUse!.name,
        form_definition_id: form_id,
        data: formData,
        // Definir status de pagamento apenas quando aplicável (evita enum inválido)
        ...(require_payment ? { payment_status: 'PENDENTE' } : {}),
        // Persistir o valor previsto do pagamento na submissão para métricas e consistência
        ...(require_payment
          ? { payment_amount }
          : {}),
        ip_address: ip,
        user_agent: userAgent,
        metadata: {
          submitted_at: new Date().toISOString(),
          form_title,
        },
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Error creating submission:', submissionError);
      return NextResponse.json(
        { error: 'Erro ao criar submissão', detail: submissionError.message },
        { status: 500 }
      );
    }

    // Se requer pagamento, retornar info para redirecionar ao checkout
    if (require_payment) {
      return NextResponse.json({
        success: true,
        submission_id: submission.id,
        requires_payment: true,
        payment_amount,
        message: 'Submissão criada. Redirecionando para pagamento...',
      });
    }

    // Resposta de sucesso
    return NextResponse.json({
      success: true,
      submission_id: submission.id,
      requires_payment: false,
      message: typeof (settings as Record<string, unknown>).success_message === 'string'
        ? ((settings as Record<string, unknown>).success_message as string)
        : 'Formulário enviado com sucesso!',
      redirect_url: typeof (settings as Record<string, unknown>).redirect_url === 'string'
        ? ((settings as Record<string, unknown>).redirect_url as string)
        : null,
    });
  } catch (error: unknown) {
    console.error('Error in public submission:', error);
    return NextResponse.json(
      { error: 'Erro ao processar submissão' },
      { status: 500 }
    );
  }
}
