/*
# Criação das tabelas principais do sistema Lunara Afiliados

1. Tabelas Principais
   - users: Usuários do sistema
   - affiliates: Afiliados
   - therapists: Terapeutas
   - services: Serviços oferecidos
   - bookings: Agendamentos
   - commissions: Comissões
   - licenses: Licenças do sistema

2. Segurança
   - RLS habilitado em todas as tabelas
   - Políticas de segurança adequadas
   - Índices para performance

3. Dados Padrão
   - Usuário master
   - Dados de exemplo para desenvolvimento
*/

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'affiliate' CHECK (role IN ('admin', 'therapist', 'affiliate')),
    is_active BOOLEAN DEFAULT TRUE,
    is_master BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de afiliados
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 15.00,
    total_referrals INTEGER DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de terapeutas
CREATE TABLE IF NOT EXISTS therapists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(255) NOT NULL,
    bio TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 30.00,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de serviços
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
    affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    client_phone VARCHAR(20),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded')),
    notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de comissões
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    payment_date TIMESTAMP,
    payment_method VARCHAR(100),
    payment_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de licenças
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_key VARCHAR(50) UNIQUE NOT NULL,
    license_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
    activated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    activated_at TIMESTAMP,
    expires_at TIMESTAMP,
    max_users INTEGER DEFAULT 1,
    current_users INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_therapists_user_id ON therapists(user_id);
CREATE INDEX IF NOT EXISTS idx_therapists_specialty ON therapists(specialty);
CREATE INDEX IF NOT EXISTS idx_services_therapist_id ON services(therapist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_therapist_id ON bookings(therapist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_affiliate_id ON bookings(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_licenses_serial_key ON licenses(serial_key);

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para users
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas RLS para affiliates
CREATE POLICY "Affiliates can read own data" ON affiliates
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read all affiliates" ON affiliates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas RLS para therapists
CREATE POLICY "Therapists can read own data" ON therapists
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Everyone can read active therapists" ON therapists
    FOR SELECT USING (is_available = true);

-- Políticas RLS para services
CREATE POLICY "Everyone can read active services" ON services
    FOR SELECT USING (is_active = true);

CREATE POLICY "Therapists can manage own services" ON services
    FOR ALL USING (
        therapist_id IN (
            SELECT id FROM therapists WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para bookings
CREATE POLICY "Users can read own bookings" ON bookings
    FOR SELECT USING (
        client_email = (SELECT email FROM users WHERE id = auth.uid())
        OR therapist_id IN (SELECT id FROM therapists WHERE user_id = auth.uid())
        OR affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
    );

-- Políticas RLS para commissions
CREATE POLICY "Affiliates can read own commissions" ON commissions
    FOR SELECT USING (
        affiliate_id IN (
            SELECT id FROM affiliates WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can read all commissions" ON commissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas RLS para licenses
CREATE POLICY "Admins can manage licenses" ON licenses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Inserir usuário master
INSERT INTO users (
    id, 
    name, 
    email, 
    password_hash, 
    role, 
    is_active, 
    is_master
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Celso Bif',
    'celsot.holistics@gmail.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8YXQoTwgNO', -- senha: Master123!
    'admin',
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Inserir licenças master
INSERT INTO licenses (serial_key, license_type, status, activated_by, activated_at, expires_at, max_users) VALUES
('LUNA-MASTER-X9K7-M2P5-Q8R3', 'master', 'active', '00000000-0000-0000-0000-000000000001', NOW(), NOW() + INTERVAL '10 years', 999),
('LUNA-MASTER-L4N6-V7W9-T1Y4', 'master', 'pending', NULL, NULL, NOW() + INTERVAL '10 years', 999),
('LUNA-MASTER-F3H8-B5C2-D9G1', 'master', 'pending', NULL, NULL, NOW() + INTERVAL '10 years', 999)
ON CONFLICT (serial_key) DO NOTHING;

-- Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_therapists_updated_at BEFORE UPDATE ON therapists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();