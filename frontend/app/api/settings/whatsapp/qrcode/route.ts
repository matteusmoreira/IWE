import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Endpoint: POST /api/settings/whatsapp/qrcode
// Objetivo: obter QR Code da instância na Evolution API v2
// Estratégia: tentar /instance/qrcode/{instance}; se falhar, tentar /instance/connect/{instance}
// Retorno: { success, message, state, qrcode_base64 }

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permissão: admin e superadmin podem visualizar QR Code
  const { data: roleRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  const role = roleRow?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { api_url, api_key, instance_name } = body;

    if (!api_url || !api_key || !instance_name) {
      return NextResponse.json(
        { error: 'API URL, API Key e instance_name são obrigatórios' },
        { status: 400 }
      );
    }

    const baseUrl = String(api_url).replace(/\/+$/, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

    const headers: Record<string, string> = {
      'apikey': api_key,
      'Content-Type': 'application/json',
    };

    const toBase64 = async (resp: Response) => {
      const buf = await resp.arrayBuffer();
      // Converter ArrayBuffer -> base64
      const bytes = Buffer.from(buf);
      return bytes.toString('base64');
    };

    try {
      // 1) Tentar endpoint direto de QR Code
      const qrUrl = `${baseUrl}/instance/qrcode/${encodeURIComponent(instance_name)}`;
      const qrRes = await fetch(qrUrl, { method: 'GET', headers, signal: controller.signal });

      if (qrRes.ok) {
        const contentType = qrRes.headers.get('content-type') || '';
        if (contentType.includes('image')) {
          const base64 = await toBase64(qrRes);
          clearTimeout(timeoutId);
          return NextResponse.json({ success: true, message: 'QR Code obtido com sucesso.', state: 'qrcode', qrcode_base64: base64 });
        }
        // Pode retornar JSON com qrcode.base64
        const json = await qrRes.json().catch(() => null);
        const base64 = json?.qrcode?.base64 || json?.base64 || null;
        if (base64) {
          clearTimeout(timeoutId);
          return NextResponse.json({ success: true, message: 'QR Code obtido com sucesso.', state: 'qrcode', qrcode_base64: base64 });
        }
        // Se não houver imagem nem base64, prosseguir para connect
      }

      // 2) Fallback: tentar conectar (pode retornar qrcode)
      const connectUrl = `${baseUrl}/instance/connect/${encodeURIComponent(instance_name)}`;
      const connRes = await fetch(connectUrl, { method: 'GET', headers, signal: controller.signal });

      if (!connRes.ok) {
        const errorText = await connRes.text().catch(() => 'Erro desconhecido');
        clearTimeout(timeoutId);
        return NextResponse.json({ success: false, error: `Erro ao conectar: ${connRes.status} - ${errorText}` }, { status: 400 });
      }

      const connJson = await connRes.json().catch(() => null);
      const state = connJson?.instance?.state ?? connJson?.state ?? null;
      const base64 = connJson?.qrcode?.base64 ?? connJson?.base64 ?? null;

      clearTimeout(timeoutId);

      if (base64) {
        return NextResponse.json({ success: true, message: 'QR Code obtido com sucesso.', state: state || 'qrcode', qrcode_base64: base64 });
      }

      if (state && (String(state).toLowerCase() === 'open' || String(state).toLowerCase() === 'connected')) {
        return NextResponse.json({ success: true, message: 'Instância já está conectada.', state });
      }

      return NextResponse.json({ success: false, error: 'Não foi possível obter o QR Code. Verifique se a instância está aguardando pareamento (state=qrcode).' }, { status: 404 });

    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        return NextResponse.json({ success: false, error: 'Timeout ao obter QR Code.' }, { status: 408 });
      }
      return NextResponse.json({ success: false, error: `Erro: ${err?.message || 'desconhecido'}` }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, error: `Erro interno: ${error.message}` }, { status: 500 });
  }
}