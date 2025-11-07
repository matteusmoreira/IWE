IWE Frontend — Pagamentos Mercado Pago (Global)

O que foi atualizado
- Preferência de pagamento utiliza credenciais globais do Mercado Pago via variável de ambiente MP_ACCESS_TOKEN (não há mais dependência de config por tenant/polo).
- Webhook de pagamento também usa o token global para consultar detalhes de pagamento.
- Adicionado MP_STATEMENT_DESCRIPTOR (opcional) para personalizar como o nome aparece na fatura do cartão.

Variáveis de ambiente
- MP_ACCESS_TOKEN: Obrigatório. Token de acesso (apenas no servidor).
- MP_PUBLIC_KEY: Opcional/cliente se necessário.
- APP_URL: Obrigatório. Base para back_urls e notification_url.
- MP_WEBHOOK_SECRET: Opcional. Caso implemente verificação de assinatura (não habilitado por padrão).
- MP_STATEMENT_DESCRIPTOR: Opcional. Texto na fatura (máx. 22 caracteres). Padrão: "IWE".

Fluxo de pagamento
1. Após enviar o formulário com require_payment habilitado e valor válido (> 0), a API /api/payments/create-preference cria a preferência no Mercado Pago usando o token global.
2. O usuário é redirecionado para init_point.
3. O Mercado Pago envia o webhook para /api/webhooks/mercadopago.
4. O sistema atualiza o status da submissão e dispara notificações (WhatsApp/E-mail) conforme configuração.

Como testar (local)
- Configure .env.local conforme .env.local.example.
- Inicie o servidor: npm run dev.
- Submeta um formulário com require_payment=true e payment_amount>0.
- Verifique o redirecionamento para a página de checkout (init_point).

Observações
- Configurações de WhatsApp/Moodle continuam por tenant. Apenas a integração do Mercado Pago é global.