-- ============================================
-- SaaS IWE - Schema Inicial
-- Migration 001: Estrutura Multi-tenant Base
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'user');
CREATE TYPE payment_status AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'REEMBOLSADO');
CREATE TYPE payment_provider AS ENUM ('mercadopago', 'manual');
CREATE TYPE field_type AS ENUM ('text', 'email', 'phone', 'select', 'date', 'file', 'checkbox', 'textarea', 'number');
CREATE TYPE enrollment_status AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');
CREATE TYPE message_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED');

-- ============================================
-- TABLE: tenants (Polos)
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================
-- TABLE: users
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);

-- ============================================
-- TABLE: admin_tenants (Relacionamento N:N)
-- ============================================

CREATE TABLE admin_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_admin_tenants_user ON admin_tenants(user_id);
CREATE INDEX idx_admin_tenants_tenant ON admin_tenants(tenant_id);

-- ============================================
-- TABLE: form_definitions (Formulários)
-- ============================================

CREATE TABLE form_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    redirect_url_after_flow TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_form_definitions_tenant ON form_definitions(tenant_id);
CREATE INDEX idx_form_definitions_slug ON form_definitions(slug);
CREATE INDEX idx_form_definitions_active ON form_definitions(is_active);

-- ============================================
-- TABLE: form_fields (Campos do formulário)
-- ============================================

CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_definition_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type field_type NOT NULL,
    required BOOLEAN DEFAULT false,
    placeholder TEXT,
    options JSONB DEFAULT '[]',
    validation_rules JSONB DEFAULT '{}',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_form_fields_form ON form_fields(form_definition_id);
CREATE INDEX idx_form_fields_order ON form_fields(form_definition_id, order_index);

-- ============================================
-- TABLE: submissions (Submissões de formulário)
-- ============================================

CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    form_definition_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    polo VARCHAR(255),
    payment_status payment_status DEFAULT 'PENDENTE',
    payment_provider payment_provider DEFAULT 'mercadopago',
    payment_reference VARCHAR(255),
    payment_external_id VARCHAR(255),
    payment_amount DECIMAL(10, 2),
    payment_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX idx_submissions_form ON submissions(form_definition_id);
CREATE INDEX idx_submissions_status ON submissions(payment_status);
CREATE INDEX idx_submissions_external_id ON submissions(payment_external_id);
CREATE INDEX idx_submissions_created ON submissions(created_at DESC);

-- ============================================
-- TABLE: payment_events (Eventos de pagamento - idempotência)
-- ============================================

CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    provider payment_provider NOT NULL,
    raw_payload JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_events_submission ON payment_events(submission_id);
CREATE INDEX idx_payment_events_event_id ON payment_events(event_id);

-- ============================================
-- TABLE: whatsapp_configs (Config WhatsApp por tenant)
-- ============================================

CREATE TABLE whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    api_base_url TEXT NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    default_sender VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_configs_tenant ON whatsapp_configs(tenant_id);

-- ============================================
-- TABLE: message_templates (Templates de mensagem)
-- ============================================

CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);

CREATE INDEX idx_message_templates_tenant ON message_templates(tenant_id);
CREATE INDEX idx_message_templates_key ON message_templates(key);

-- ============================================
-- TABLE: message_logs (Histórico de disparos)
-- ============================================

CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    message_content TEXT NOT NULL,
    status message_status DEFAULT 'PENDING',
    external_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_logs_tenant ON message_logs(tenant_id);
CREATE INDEX idx_message_logs_submission ON message_logs(submission_id);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE INDEX idx_message_logs_created ON message_logs(created_at DESC);

-- ============================================
-- TABLE: schedule_jobs (Agendamento de disparos)
-- ============================================

CREATE TABLE schedule_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    recipient_phones TEXT[] NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_schedule_jobs_tenant ON schedule_jobs(tenant_id);
CREATE INDEX idx_schedule_jobs_scheduled ON schedule_jobs(scheduled_for);
CREATE INDEX idx_schedule_jobs_status ON schedule_jobs(status);

-- ============================================
-- TABLE: outbound_webhook_configs (Config webhooks saída)
-- ============================================

CREATE TABLE outbound_webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    enrollment_webhook_url TEXT NOT NULL,
    enrollment_webhook_token TEXT,
    timeout_ms INTEGER DEFAULT 30000,
    retries INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_outbound_webhook_configs_tenant ON outbound_webhook_configs(tenant_id);

-- ============================================
-- TABLE: enrollment_logs (Logs de matrícula)
-- ============================================

CREATE TABLE enrollment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    status enrollment_status DEFAULT 'QUEUED',
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enrollment_logs_tenant ON enrollment_logs(tenant_id);
CREATE INDEX idx_enrollment_logs_submission ON enrollment_logs(submission_id);
CREATE INDEX idx_enrollment_logs_status ON enrollment_logs(status);

-- ============================================
-- TABLE: audit_logs (Auditoria)
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- TABLE: mercadopago_configs (Config Mercado Pago)
-- ============================================

CREATE TABLE mercadopago_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    public_key TEXT,
    webhook_secret TEXT,
    is_production BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mercadopago_configs_tenant ON mercadopago_configs(tenant_id);

-- ============================================
-- FUNCTIONS: updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_definitions_updated_at BEFORE UPDATE ON form_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at BEFORE UPDATE ON form_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_configs_updated_at BEFORE UPDATE ON whatsapp_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_webhook_configs_updated_at BEFORE UPDATE ON outbound_webhook_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mercadopago_configs_updated_at BEFORE UPDATE ON mercadopago_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercadopago_configs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is admin of a tenant
CREATE OR REPLACE FUNCTION auth.is_admin_of_tenant(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_tenants at
        JOIN users u ON u.id = at.user_id
        WHERE u.auth_user_id = auth.uid()
        AND at.tenant_id = tenant_uuid
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies for tenants
CREATE POLICY "Superadmins can view all tenants"
    ON tenants FOR SELECT
    USING (auth.user_role() = 'superadmin');

CREATE POLICY "Admins can view their tenants"
    ON tenants FOR SELECT
    USING (
        auth.user_role() = 'admin' AND
        id IN (
            SELECT tenant_id FROM admin_tenants at
            JOIN users u ON u.id = at.user_id
            WHERE u.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Superadmins can manage tenants"
    ON tenants FOR ALL
    USING (auth.user_role() = 'superadmin');

-- Policies for submissions (public can insert)
CREATE POLICY "Anyone can create submissions"
    ON submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Superadmins can view all submissions"
    ON submissions FOR SELECT
    USING (auth.user_role() = 'superadmin');

CREATE POLICY "Admins can view their tenant submissions"
    ON submissions FOR SELECT
    USING (
        auth.user_role() = 'admin' AND
        auth.is_admin_of_tenant(tenant_id)
    );

CREATE POLICY "Admins can update their tenant submissions"
    ON submissions FOR UPDATE
    USING (
        auth.user_role() = 'admin' AND
        auth.is_admin_of_tenant(tenant_id)
    );

CREATE POLICY "Admins can delete their tenant submissions"
    ON submissions FOR DELETE
    USING (
        auth.user_role() = 'admin' AND
        auth.is_admin_of_tenant(tenant_id)
    );

-- Similar policies for other tables (form_definitions, configs, etc.)
-- For brevity, applying tenant-based access pattern

CREATE POLICY "Tenant-based access for form_definitions"
    ON form_definitions FOR ALL
    USING (
        auth.user_role() = 'superadmin' OR
        (auth.user_role() = 'admin' AND auth.is_admin_of_tenant(tenant_id))
    );

CREATE POLICY "Tenant-based access for message_templates"
    ON message_templates FOR ALL
    USING (
        auth.user_role() = 'superadmin' OR
        (auth.user_role() = 'admin' AND auth.is_admin_of_tenant(tenant_id))
    );

CREATE POLICY "Tenant-based access for whatsapp_configs"
    ON whatsapp_configs FOR ALL
    USING (
        auth.user_role() = 'superadmin' OR
        (auth.user_role() = 'admin' AND auth.is_admin_of_tenant(tenant_id))
    );

CREATE POLICY "Tenant-based access for mercadopago_configs"
    ON mercadopago_configs FOR ALL
    USING (
        auth.user_role() = 'superadmin' OR
        (auth.user_role() = 'admin' AND auth.is_admin_of_tenant(tenant_id))
    );

-- ============================================
-- VIEWS: Dashboard Metrics
-- ============================================

CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(DISTINCT s.id) as total_submissions,
    COUNT(DISTINCT CASE WHEN s.payment_status = 'PAGO' THEN s.id END) as paid_submissions,
    COUNT(DISTINCT CASE WHEN s.payment_status = 'PENDENTE' THEN s.id END) as pending_submissions,
    COALESCE(SUM(CASE WHEN s.payment_status = 'PAGO' THEN s.payment_amount ELSE 0 END), 0) as total_revenue,
    ROUND(
        (COUNT(DISTINCT CASE WHEN s.payment_status = 'PAGO' THEN s.id END)::DECIMAL / 
         NULLIF(COUNT(DISTINCT s.id), 0) * 100), 
        2
    ) as conversion_rate
FROM tenants t
LEFT JOIN submissions s ON s.tenant_id = t.id
WHERE t.status = true
GROUP BY t.id, t.name;

-- ============================================
-- SUCCESS
-- ============================================

COMMENT ON SCHEMA public IS 'SaaS IWE - Multi-tenant Education Platform';
