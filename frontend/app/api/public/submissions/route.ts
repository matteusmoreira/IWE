import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

// Cliente público do Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/public/submissions - Criar nova submissão (público)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { form_id, data: formData, tenant_id } = body;

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
    let tenantToUse: { id: string; name: string; status: boolean } | null = null;

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
      tenantToUse = fixedTenant as any;
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
      tenantToUse = selectedTenant as any;
    }

    // Validar campos obrigatórios
    const requiredFields = form.form_fields?.filter((field: any) => field.required);
    const missingFields = requiredFields?.filter(
      (field: any) => !formData[field.name] || formData[field.name] === ''
    );

    if (missingFields && missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Campos obrigatórios não preenchidos',
          missing_fields: missingFields.map((f: any) => f.name),
        },
        { status: 400 }
      );
    }

    // Validar tipos de dados
    for (const field of form.form_fields || []) {
      const value = formData[field.name];
      
      if (!value) continue; // Pula se não foi preenchido (já validamos required acima)

      // Validação de email
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return NextResponse.json(
            { error: `Campo ${field.name} deve ser um email válido` },
            { status: 400 }
          );
        }
      }

      // Validação de CPF (formato básico)
      if (field.type === 'cpf' && value) {
        const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
        if (!cpfRegex.test(value)) {
          return NextResponse.json(
            { error: `Campo ${field.name} deve ser um CPF válido (000.000.000-00)` },
            { status: 400 }
          );
        }
      }

      // Validação de CEP
      if (field.type === 'cep' && value) {
        const cepRegex = /^\d{5}-\d{3}$/;
        if (!cepRegex.test(value)) {
          return NextResponse.json(
            { error: `Campo ${field.name} deve ser um CEP válido (00000-000)` },
            { status: 400 }
          );
        }
      }

      // Validação de número
      if (field.type === 'number' && value) {
        if (isNaN(Number(value))) {
          return NextResponse.json(
            { error: `Campo ${field.name} deve ser um número` },
            { status: 400 }
          );
        }

        // Validar min/max se definidos
        if (field.validation_rules?.min !== undefined) {
          if (Number(value) < field.validation_rules.min) {
            return NextResponse.json(
              { error: `Campo ${field.name} deve ser no mínimo ${field.validation_rules.min}` },
              { status: 400 }
            );
          }
        }
        if (field.validation_rules?.max !== undefined) {
          if (Number(value) > field.validation_rules.max) {
            return NextResponse.json(
              { error: `Campo ${field.name} deve ser no máximo ${field.validation_rules.max}` },
              { status: 400 }
            );
          }
        }
      }

      // Validação de comprimento de texto
      if ((field.type === 'text' || field.type === 'textarea') && value) {
        if (field.validation_rules?.minLength && value.length < field.validation_rules.minLength) {
          return NextResponse.json(
            { error: `Campo ${field.name} deve ter no mínimo ${field.validation_rules.minLength} caracteres` },
            { status: 400 }
          );
        }
        if (field.validation_rules?.maxLength && value.length > field.validation_rules.maxLength) {
          return NextResponse.json(
            { error: `Campo ${field.name} deve ter no máximo ${field.validation_rules.maxLength} caracteres` },
            { status: 400 }
          );
        }
      }
    }

    // Verificação de duplicidade: Nome + CPF
    // - Identifica dinamicamente os campos de nome e cpf do formulário
    // - Bloqueia nova submissão quando já existir registro com mesmo CPF
    //   (e opcionalmente mesmo nome) em qualquer formulário do sistema.
    const cpfField = (form.form_fields || []).find((f: any) => f.type === 'cpf')?.name;
    const nameField = (form.form_fields || [])
      .find((f: any) => {
        const n = (f.name || '').toLowerCase();
        return ['nome_completo', 'nome', 'name'].includes(n);
      })?.name;

    const cpfValueRaw = cpfField ? formData[cpfField] : null;
    const nameValueRaw = nameField ? formData[nameField] : null;

    if (cpfValueRaw) {
      // Busca por CPF exatamente igual (formato mascarado). Como o frontend aplica máscara,
      // isso evita falsos negativos por diferenças de formatação.
      // Se também houver nome, exige ambos para reduzir falso-positivo em casos raros.
      let dupQuery = admin
        .from('submissions')
        .select('id')
        .eq(`data->>${cpfField}`, cpfValueRaw)
        .limit(1);

      if (nameValueRaw) {
        dupQuery = dupQuery.eq(`data->>${nameField}`, nameValueRaw);
      }

      const { data: dup, error: dupError } = await dupQuery;
      if (dupError) {
        console.error('Erro ao verificar duplicidade:', dupError);
        // Prossegue sem bloquear se houver erro de verificação
      } else if (dup && dup.length > 0) {
        return NextResponse.json(
          { error: 'Aluno já cadastrado no sistema!' },
          { status: 409 }
        );
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
    const { data: submission, error: submissionError } = await admin
      .from('submissions')
      .insert({
        tenant_id: tenantToUse!.id,
        polo: tenantToUse!.name,
        form_definition_id: form_id,
        data: formData,
        // Definir status de pagamento apenas quando aplicável (evita enum inválido)
        ...(form.settings?.require_payment ? { payment_status: 'PENDENTE' } : {}),
        // Persistir o valor previsto do pagamento na submissão para métricas e consistência
        ...(form.settings?.require_payment
          ? { payment_amount: Number(form.settings?.payment_amount ?? 0) }
          : {}),
        ip_address: ip,
        user_agent: userAgent,
        metadata: {
          submitted_at: new Date().toISOString(),
          form_title: form.settings?.form_title || 'Formulário',
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
    if (form.settings?.require_payment) {
      return NextResponse.json({
        success: true,
        submission_id: submission.id,
        requires_payment: true,
        payment_amount: form.settings.payment_amount || 0,
        message: 'Submissão criada. Redirecionando para pagamento...',
      });
    }

    // Resposta de sucesso
    return NextResponse.json({
      success: true,
      submission_id: submission.id,
      requires_payment: false,
      message: form.settings?.success_message || 'Formulário enviado com sucesso!',
      redirect_url: form.settings?.redirect_url || null,
    });
  } catch (error: any) {
    console.error('Error in public submission:', error);
    return NextResponse.json(
      { error: 'Erro ao processar submissão' },
      { status: 500 }
    );
  }
}
