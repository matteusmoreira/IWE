import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permissão: admin e superadmin podem testar configuração
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

    if (!api_url || !api_key) {
      return NextResponse.json(
        { error: 'API URL e API Key são obrigatórios' },
        { status: 400 }
      );
    }

    // Normaliza a URL base removendo barras finais duplicadas
    const baseUrl = String(api_url).replace(/\/+$/, '');

    // Testar conexão com a Evolution API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      // Se informado, testa o estado de conexão da instância específica
      let connectionState: any = null;
      if (instance_name) {
        const connResponse = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance_name)}`, {
          method: 'GET',
          headers: {
            'apikey': api_key,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!connResponse.ok) {
          const errorText = await connResponse.text().catch(() => 'Erro desconhecido');
          return NextResponse.json({
            success: false,
            error: `Erro na API (connectionState): ${connResponse.status} - ${errorText}`,
            instances: [],
            connection_state: null,
          }, { status: 400 });
        }

        connectionState = await connResponse.json().catch(() => null);
      }

      // Buscar instâncias disponíveis
      const instancesResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': api_key,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!instancesResponse.ok) {
        const errorText = await instancesResponse.text().catch(() => 'Erro desconhecido');
        return NextResponse.json({
          success: false,
          error: `Erro ao buscar instâncias: ${instancesResponse.status} - ${errorText}`,
          instances: [],
          connection_status: 'error'
        }, { status: 400 });
      }

      const rawInstances = await instancesResponse.json();

      // Helper: extrai telefone do owner JID
      const ownerToPhone = (owner: string | null | undefined) => {
        if (!owner) return 'Não disponível';
        const match = String(owner).match(/^(\d+)/);
        return match ? match[1] : 'Não disponível';
      };

      // Formatar dados das instâncias conforme docs oficiais
      // Docs: GET /instance/fetchInstances retorna array de objetos com a chave "instance"
      const instances = Array.isArray(rawInstances)
        ? rawInstances.map((item: any) => {
            const inst = item.instance ?? item;
            return {
              name: inst.instanceName || inst.name || 'Desconhecido',
              status: inst.status || inst.state || 'unknown',
              number: inst.phone || ownerToPhone(inst.owner),
              owner: inst.owner || 'Não disponível',
              profileName: inst.profileName || inst.profile?.name || 'Não disponível',
              profilePictureUrl: inst.profilePictureUrl || inst.profile?.picture || null,
            };
          })
        : [];

      // Verificar se há instâncias conectadas
      const connectedInstances = instances.filter((instance: any) => {
        const s = String(instance.status || '').toLowerCase();
        return s === 'open' || s === 'connected';
      });

      return NextResponse.json({
        success: true,
        message: `Conexão bem-sucedida! ${instances.length} instância(s) encontrada(s), ${connectedInstances.length} conectada(s).`,
        instances,
        connection_state: connectionState?.instance?.state ?? connectionState?.state ?? null,
        total_instances: instances.length,
        connected_instances: connectedInstances.length
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Timeout na conexão. Verifique se a URL está correta e a API está acessível.',
          instances: [],
          connection_status: 'timeout'
        }, { status: 408 });
      }

      return NextResponse.json({
        success: false,
        error: `Erro de conexão: ${fetchError.message}`,
        instances: [],
        connection_status: 'connection_error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('WhatsApp test error:', error);
    return NextResponse.json({
      success: false,
      error: `Erro interno: ${error.message}`,
      instances: [],
      connection_status: 'internal_error'
    }, { status: 500 });
  }
}