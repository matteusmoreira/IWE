/**
 * Envia uma mensagem de texto de teste via Evolution API v2.
 * Variáveis necessárias (use .env.local ou defina no ambiente):
 * - EVOLUTION_API_URL (sem barra no final)
 * - EVOLUTION_API_KEY
 * - EVOLUTION_INSTANCE_NAME
 * - EVOLUTION_TEST_NUMBER (E.164, ex.: 5511999998888)
 *
 * Uso:
 *   node frontend/scripts/send-test-evolution-api.mjs "Mensagem opcional"
 *
 * Observações:
 * - Não imprime a API key; máscara é usada em logs.
 * - Falhas são mostradas com status e corpo de resposta sem segredos.
 */


const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
const apiKey = process.env.EVOLUTION_API_KEY || '';
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || '';
const testNumber = process.env.EVOLUTION_TEST_NUMBER || '';
const message = process.argv[2] || 'Teste IWE — mensagem automática';

function mask(token) {
  if (!token) return '***';
  const head = token.slice(0, 6);
  return `${head}***`;
}

if (!baseUrl || !apiKey || !instanceName || !testNumber) {
  console.error('Erro: defina EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME e EVOLUTION_TEST_NUMBER.');
  process.exit(1);
}

const headers = { apikey: apiKey, 'Content-Type': 'application/json' };

async function sendText() {
  try {
    // Opcional: checar estado de conexão antes de enviar
    const connRes = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, { headers });
    const connBody = await connRes.json().catch(() => ({}));
    const state = connBody?.instance?.state ?? connBody?.state ?? 'unknown';
    console.log('Estado da conexão:', state);

    // Envio
    const url = `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
    const body = { number: String(testNumber), text: String(message) };
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await resp.json().catch(async () => ({ raw: await resp.text().catch(() => 'N/A') }));
    if (!resp.ok) {
      console.error('Falha ao enviar:', resp.status, json);
      process.exit(1);
    }
    console.log('Disparo realizado com sucesso:', {
      status: resp.status,
      to: testNumber,
      instance: instanceName,
      api_key_masked: mask(apiKey),
      result: json,
    });
  } catch (err) {
    console.error('Erro geral no disparo:', err?.message || err);
    process.exit(1);
  }
}

sendText();