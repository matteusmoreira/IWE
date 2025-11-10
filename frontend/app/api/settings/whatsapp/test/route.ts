import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
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
      let connectionState: unknown = null;
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
      const ownerToPhone = (owner: unknown) => {
        const s = typeof owner === 'string' ? owner : undefined;
        if (!s) return 'Não disponível';
        const match = String(s).match(/^(\d+)/);
        return match ? match[1] : 'Não disponível';
      };

      const asRecord = (u: unknown): Record<string, unknown> =>
        typeof u === 'object' && u !== null ? (u as Record<string, unknown>) : {};
      const getString = (v: unknown): string | undefined => {
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        return undefined;
      };

      // Formatar dados das instâncias conforme docs oficiais
      // Docs: GET /instance/fetchInstances retorna array de objetos com a chave "instance"
      // Observação: algumas versões da Evolution API expõem o estado de conexão
      // no campo `connectionStatus` do objeto `instance`. Nosso mapeamento anterior
      // considerava apenas `status`/`state`, o que pode resultar em "0 conectadas"
      // mesmo quando a instância está com `connectionStatus = open/connected`.
      // Abaixo incluímos `connectionStatus` e usamos esse campo como principal
      // para determinar se a instância está conectada.
      type InstanceInfo = {
        name: string;
        status: string;
        connectionStatus: string;
        number: string | null;
        owner: string;
        profileName: string;
        profilePictureUrl: string | null;
      };

      const instances: InstanceInfo[] = Array.isArray(rawInstances)
        ? rawInstances.map((item: unknown) => {
            const itemRec = asRecord(item);
            const inst = asRecord(itemRec.instance ?? item);
            const name = getString(inst.instanceName) ?? getString(inst.name) ?? 'Desconhecido';
            const status = getString(inst.status) ?? getString(inst.state) ?? 'unknown';
            const connectionStatus = getString(inst.connectionStatus) ?? getString(inst.state) ?? 'unknown';
            const number = getString(inst.phone) ?? ownerToPhone(inst.owner);
            const owner = getString(inst.owner) ?? 'Não disponível';
            const profileRec = asRecord(inst.profile);
            const profileName = getString(inst.profileName) ?? getString(profileRec.name) ?? 'Não disponível';
            const profilePictureUrl = getString(inst.profilePictureUrl) ?? getString(profileRec.picture) ?? null;
            return {
              name,
              status,
              connectionStatus,
              number: number ?? null,
              owner,
              profileName,
              profilePictureUrl,
            };
          })
        : [];

      // Verificar se há instâncias conectadas
      const connectedInstances = instances.filter((instance) => {
        const s = String((instance.connectionStatus ?? instance.status) || '').toLowerCase();
        return s === 'open' || s === 'connected';
      });

      // Registrar auditoria do último estado (sem segredos)
      let connection_state: string | null = null;
      try {
        const connStateObj = asRecord(connectionState);
        const connStateInstance = asRecord(connStateObj.instance);
        connection_state = getString(connStateInstance.state) ?? getString(connStateObj.state) ?? null;

        await supabase.from('audit_logs').insert({
          user_id: roleRow?.id ?? null,
          tenant_id: null,
          action: 'whatsapp_test',
          resource_type: 'evolution_api',
          resource_id: instance_name ?? null,
          changes: {
            connection_state,
            total_instances: instances.length,
            connected_instances: connectedInstances.length,
            instances: instances.map((i) => ({
              name: i.name,
              status: i.status,
              connectionStatus: i.connectionStatus,
              number: i.number,
            })),
          },
        });
      } catch (auditErr) {
        console.warn('Falha ao registrar auditoria do teste WhatsApp:', auditErr);
      }

      return NextResponse.json({
        success: true,
        message: `Conexão bem-sucedida! ${instances.length} instância(s) encontrada(s), ${connectedInstances.length} conectada(s).`,
        instances,
        connection_state,
        total_instances: instances.length,
        connected_instances: connectedInstances.length
      });

    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Timeout na conexão. Verifique se a URL está correta e a API está acessível.',
          instances: [],
          connection_status: 'timeout'
        }, { status: 408 });
      }

      return NextResponse.json({
        success: false,
        error: `Erro de conexão: ${fetchError instanceof Error ? fetchError.message : 'Erro desconhecido'}`,
        instances: [],
        connection_status: 'connection_error'
      }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('WhatsApp test error:', error);
    return NextResponse.json({
      success: false,
      error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      instances: [],
      connection_status: 'internal_error'
    }, { status: 500 });
  }
}