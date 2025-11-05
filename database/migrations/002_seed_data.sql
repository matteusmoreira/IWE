-- ============================================
-- SaaS IWE - Dados Iniciais
-- Migration 002: Seeds e dados de exemplo
-- ============================================

-- Inserir tenant de exemplo
INSERT INTO tenants (id, name, slug, status, settings)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Polo Minas Gerais', 'polo-mg', true, '{"timezone": "America/Sao_Paulo"}'),
    ('22222222-2222-2222-2222-222222222222', 'Polo São Paulo', 'polo-sp', true, '{"timezone": "America/Sao_Paulo"}');

-- Templates de mensagem padrão para cada tenant
INSERT INTO message_templates (tenant_id, key, title, content, variables, is_active)
VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'payment_approved',
        'Pagamento Aprovado',
        E'Olá {{nome_completo}}! 🎉\n\nSeu pagamento foi confirmado com sucesso!\n\n✅ Curso: {{curso}}\n📍 Polo: {{polo}}\n💰 Valor: R$ {{valor}}\n\nEm breve você receberá os dados de acesso ao Moodle.\n\nBem-vindo(a) ao IWE! 📚',
        '["nome_completo", "curso", "polo", "valor"]',
        true
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'payment_approved',
        'Pagamento Aprovado',
        E'Olá {{nome_completo}}! 🎉\n\nSeu pagamento foi confirmado com sucesso!\n\n✅ Curso: {{curso}}\n📍 Polo: {{polo}}\n💰 Valor: R$ {{valor}}\n\nEm breve você receberá os dados de acesso ao Moodle.\n\nBem-vindo(a) ao IWE! 📚',
        '["nome_completo", "curso", "polo", "valor"]',
        true
    );

-- Template de boas-vindas
INSERT INTO message_templates (tenant_id, key, title, content, variables, is_active)
VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'welcome',
        'Boas-vindas',
        E'Olá {{nome_completo}}! 👋\n\nSeja muito bem-vindo(a) ao Instituto Palavra da Fé!\n\nEstamos muito felizes em tê-lo(a) conosco.\n\n📚 Curso: {{curso}}\n📍 Seu polo: {{polo}}\n\nEm caso de dúvidas, entre em contato com nossa equipe.',
        '["nome_completo", "curso", "polo"]',
        true
    );

-- Template de lembrete de pagamento
INSERT INTO message_templates (tenant_id, key, title, content, variables, is_active)
VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'payment_reminder',
        'Lembrete de Pagamento',
        E'Olá {{nome_completo}}! 📢\n\nNotamos que seu pagamento ainda está pendente.\n\n⏰ Complete sua inscrição e garanta sua vaga!\n\n✅ Curso: {{curso}}\n📍 Polo: {{polo}}\n\nClique no link para finalizar: {{link_pagamento}}',
        '["nome_completo", "curso", "polo", "link_pagamento"]',
        true
    );

-- Comentário sobre próximos passos
COMMENT ON TABLE message_templates IS 'Templates de mensagens WhatsApp com placeholders dinâmicos';
COMMENT ON TABLE tenants IS 'Polos (tenants) do sistema multi-tenant';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Sample tenants created:';
    RAISE NOTICE '  - Polo Minas Gerais (polo-mg)';
    RAISE NOTICE '  - Polo São Paulo (polo-sp)';
    RAISE NOTICE '';
    RAISE NOTICE 'Default message templates created for each tenant.';
END $$;
