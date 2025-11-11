import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function sanitizeFileName(name: string) {
  // Mantém apenas letras, números, ponto, hífen e sublinhado; substitui espaços por hífen
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

// POST: Gera URL assinada de upload (sem login)
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Variáveis de ambiente do Supabase ausentes.' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const { fieldName, tenantId, fileName, fileType } = body || {};

    if (!tenantId || !fileName) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: tenantId e fileName.' }, { status: 400 });
    }

    // Validação de tipo de arquivo (público)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (fileType && !allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const safeName = sanitizeFileName(String(fileName));
    const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const storagePath = `${tenantId}/${fieldName ? fieldName + '/' : ''}${unique}-${safeName}`;

    const { data, error } = await admin.storage
      .from('form-submissions')
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl) {
      console.error('Erro createSignedUploadUrl:', error);
      return NextResponse.json({ error: 'Não foi possível gerar URL assinada de upload.' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      storagePath,
      fileType,
    });
  } catch (err) {
    console.error('Erro (POST signed-url público):', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET: Gera URL assinada de visualização para um path (uso público controlado)
export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('path');
    const format = searchParams.get('format');
    const expiresDays = Number(searchParams.get('days')) || 7;
    const expiresIn = expiresDays * 24 * 60 * 60; // segundos

    if (!storagePath) {
      return NextResponse.json({ error: 'Parâmetro path é obrigatório' }, { status: 400 });
    }

    // Garante que o path não aponte para buckets diferentes ou caminhos inseguros
    if (storagePath.includes('..') || storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
    }

    const { data, error } = await admin.storage
      .from('form-submissions')
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.error('Erro createSignedUrl (público):', error, 'path:', storagePath);
      return NextResponse.json({ error: 'Não foi possível gerar URL assinada de visualização.' }, { status: 500 });
    }

    // Se format=json, devolve o link; caso contrário, redireciona direto para o Supabase
    if (format === 'json') {
      return NextResponse.json({ signedUrl: data.signedUrl });
    }
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (err) {
    console.error('Erro (GET signed-url público):', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}