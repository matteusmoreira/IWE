/**
 * Teste simples da Evolution API v2
 * - Lista instâncias: GET /instance/fetchInstances
 * - Estado da conexão: GET /instance/connectionState/{instance}
 * Uso: defina EVOLUTION_API_URL, EVOLUTION_API_KEY e opcional EVOLUTION_INSTANCE_NAME
 * Execute: node frontend/scripts/test-evolution-api.mjs
 */

const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
const apiKey = process.env.EVOLUTION_API_KEY || '';
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || '';

if (!baseUrl || !apiKey) {
  console.error('Erro: defina EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente.');
  process.exit(1);
}

const headers = { apikey: apiKey, 'Content-Type': 'application/json' };

async function main() {
  try {
    // fetchInstances
    const instRes = await fetch(`${baseUrl}/instance/fetchInstances`, { headers });
    const instBody = await instRes.json().catch(() => ({}));
    if (!instRes.ok) {
      console.error('Falha em fetchInstances:', instRes.status, instBody);
    } else {
      const instances = Array.isArray(instBody)
        ? instBody.map((item) => {
            const inst = item.instance ?? item;
            return {
              name: inst.instanceName || inst.name || 'Desconhecido',
              status: inst.status || inst.state || 'unknown',
              connectionStatus: inst.connectionStatus || inst.state || 'unknown',
              number: inst.phone || (String(inst.owner || '').match(/^(\d+)/)?.[1] || 'Não disponível'),
            };
          })
        : [];
      console.log('Instâncias:', instances);
      console.log('Resumo:', {
        total_instances: instances.length,
        connected_instances: instances.filter((i) => {
          const s = String(i.connectionStatus || i.status).toLowerCase();
          return s === 'open' || s === 'connected';
        }).length,
      });
    }

    // connectionState (opcional)
    if (instanceName) {
      const connRes = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, { headers });
      const connBody = await connRes.json().catch(() => ({}));
      if (!connRes.ok) {
        console.error('Falha em connectionState:', connRes.status, connBody);
      } else {
        const state = connBody?.instance?.state ?? connBody?.state ?? 'unknown';
        console.log('Estado da conexão:', state);
      }
    }
  } catch (err) {
    console.error('Erro geral:', err?.message || err);
    process.exit(1);
  }
}

main();