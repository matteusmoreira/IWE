// Script para testar a geração de URLs do Mercado Pago
import { getAppUrl } from './frontend/lib/mercadopago.ts';

// Simular variáveis de ambiente
process.env.NEXT_PUBLIC_APP_URL = 'https://aie.iwegeral.com';

try {
  const appUrl = getAppUrl();
  console.log('URL base:', appUrl);
  
  // Testar geração de back_urls
  const submission_id = 'test-123';
  const backUrls = {
    success: `${appUrl}/form/pagamento/sucesso?submission_id=${submission_id}`,
    failure: `${appUrl}/form/pagamento/falha?submission_id=${submission_id}`,
    pending: `${appUrl}/form/pagamento/pendente?submission_id=${submission_id}`,
  };
  
  console.log('Back URLs geradas:');
  console.log(JSON.stringify(backUrls, null, 2));
  
  // Verificar se são URLs válidas
  for (const [key, url] of Object.entries(backUrls)) {
    try {
      new URL(url);
      console.log(`✓ ${key}: URL válida`);
    } catch (error) {
      console.log(`✗ ${key}: URL inválida - ${error.message}`);
    }
  }
  
} catch (error) {
  console.error('Erro:', error.message);
}