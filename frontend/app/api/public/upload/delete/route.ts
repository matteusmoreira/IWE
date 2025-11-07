import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Remoção pública via Service Role (sem login)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storagePath = searchParams.get('path');
    if (!storagePath) {
      return NextResponse.json({ error: 'Parâmetro path é obrigatório' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from('form-submissions')
      .remove([storagePath]);

    if (error) {
      console.error('Erro ao remover arquivo:', error);
      return NextResponse.json({ error: 'Falha ao remover arquivo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro (DELETE público):', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}