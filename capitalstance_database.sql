-- ============================================================
--  CAPITALSTANCE LIMITED — DATABASE SCHEMA
--  PostgreSQL (compatible with MySQL with minor adjustments)
--  Version: 1.0 | April 2025
-- ============================================================

-- ============================================================
--  SECTION 1: CLIENTS & CONTACTS
-- ============================================================

CREATE TABLE clients (
    id              SERIAL PRIMARY KEY,
    client_type     VARCHAR(30) NOT NULL CHECK (client_type IN ('sme','startup','director','investor','ngo','foreign_entity','individual')),
    company_name    VARCHAR(200),
    kra_pin         VARCHAR(20) UNIQUE,
    vat_number      VARCHAR(20),
    industry        VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','prospect','archived')),
    source          VARCHAR(50),           -- how they found us: referral, website, whatsapp, etc.
    onboarded_at    DATE,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contacts (
    id              SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(id) ON DELETE CASCADE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(100),          -- Director, CFO, Owner, etc.
    email           VARCHAR(200) UNIQUE,
    phone           VARCHAR(30),
    whatsapp        VARCHAR(30),
    is_primary      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 2: ENQUIRIES & LEAD MANAGEMENT
-- ============================================================

CREATE TABLE enquiries (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(200),
    phone           VARCHAR(30),
    service_interest VARCHAR(100),
    message         TEXT,
    source          VARCHAR(50) DEFAULT 'website',   -- website, whatsapp, referral, walk-in
    status          VARCHAR(30) DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
    assigned_to     INT,                              -- FK to staff table (future)
    converted_client_id INT REFERENCES clients(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 3: SERVICES & ENGAGEMENTS
-- ============================================================

CREATE TABLE services (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20) UNIQUE NOT NULL,   -- TAX-COMP, TAX-PLAN, SME-ADV, etc.
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    base_fee        DECIMAL(12,2),
    fee_type        VARCHAR(20) CHECK (fee_type IN ('fixed','monthly','hourly','retainer','project')),
    is_active       BOOLEAN DEFAULT TRUE
);

INSERT INTO services (code, name, fee_type) VALUES
    ('TAX-COMP',   'Tax Compliance (VAT, PAYE, Corporate Tax)', 'monthly'),
    ('TAX-PLAN',   'Tax Planning & Structuring',                'project'),
    ('SME-ADV',    'SME Advisory',                             'retainer'),
    ('KRA-DISP',   'KRA Support & Dispute Handling',           'project'),
    ('PAYROLL',    'Payroll & Statutory Filing',               'monthly'),
    ('CO-SETUP',   'Company Setup Advisory',                   'fixed');

CREATE TABLE engagements (
    id              SERIAL PRIMARY KEY,
    client_id       INT NOT NULL REFERENCES clients(id),
    service_id      INT NOT NULL REFERENCES services(id),
    engagement_ref  VARCHAR(50) UNIQUE,            -- e.g. ENG-2025-0042
    start_date      DATE NOT NULL,
    end_date        DATE,
    status          VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
    agreed_fee      DECIMAL(12,2),
    fee_type        VARCHAR(20),
    billing_cycle   VARCHAR(20),                   -- monthly, quarterly, on-completion
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 4: CONSULTATIONS & APPOINTMENTS
-- ============================================================

CREATE TABLE consultations (
    id              SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(id),
    enquiry_id      INT REFERENCES enquiries(id),
    contact_name    VARCHAR(200),                  -- for walk-ins / prospects
    contact_email   VARCHAR(200),
    contact_phone   VARCHAR(30),
    service_topic   VARCHAR(200),
    scheduled_at    TIMESTAMP NOT NULL,
    duration_mins   INT DEFAULT 60,
    meeting_type    VARCHAR(30) CHECK (meeting_type IN ('in-person','phone','video','whatsapp')),
    status          VARCHAR(30) DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled','no-show')),
    notes           TEXT,
    outcome         TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 5: TAX FILINGS & COMPLIANCE TRACKER
-- ============================================================

CREATE TABLE tax_obligations (
    id              SERIAL PRIMARY KEY,
    client_id       INT NOT NULL REFERENCES clients(id),
    obligation_type VARCHAR(50) NOT NULL,          -- VAT, PAYE, CIT, NSSF, NHIF, Withholding Tax
    tax_period      VARCHAR(20),                   -- e.g. '2025-03', '2025-Q1', '2024-FY'
    due_date        DATE NOT NULL,
    filed_date      DATE,
    status          VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','filed','late','amended','nil_return')),
    tax_payable     DECIMAL(12,2),
    tax_paid        DECIMAL(12,2),
    penalty_amount  DECIMAL(12,2) DEFAULT 0,
    kra_ack_number  VARCHAR(100),                  -- KRA acknowledgement number
    filed_by        INT,                           -- FK to staff
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 6: INVOICING & PAYMENTS
-- ============================================================

CREATE TABLE invoices (
    id              SERIAL PRIMARY KEY,
    invoice_number  VARCHAR(50) UNIQUE NOT NULL,   -- e.g. INV-2025-0001
    client_id       INT NOT NULL REFERENCES clients(id),
    engagement_id   INT REFERENCES engagements(id),
    issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE NOT NULL,
    subtotal        DECIMAL(12,2) NOT NULL,
    vat_amount      DECIMAL(12,2) DEFAULT 0,
    total_amount    DECIMAL(12,2) NOT NULL,
    status          VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue','cancelled')),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_items (
    id              SERIAL PRIMARY KEY,
    invoice_id      INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description     VARCHAR(500) NOT NULL,
    quantity        DECIMAL(8,2) DEFAULT 1,
    unit_price      DECIMAL(12,2) NOT NULL,
    line_total      DECIMAL(12,2) NOT NULL
);

CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    invoice_id      INT NOT NULL REFERENCES invoices(id),
    client_id       INT NOT NULL REFERENCES clients(id),
    amount          DECIMAL(12,2) NOT NULL,
    payment_date    DATE NOT NULL,
    payment_method  VARCHAR(50) CHECK (payment_method IN ('mpesa','bank_transfer','cheque','cash','card')),
    reference       VARCHAR(200),                  -- M-Pesa code, bank ref, etc.
    notes           TEXT,
    recorded_by     INT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 7: DOCUMENTS & FILES
-- ============================================================

CREATE TABLE documents (
    id              SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(id),
    engagement_id   INT REFERENCES engagements(id),
    document_type   VARCHAR(100),                  -- KRA PIN cert, Tax Return, Agreement, Payslip, etc.
    file_name       VARCHAR(300) NOT NULL,
    file_path       VARCHAR(500),                  -- storage path or URL
    file_size_kb    INT,
    uploaded_by     INT,
    is_confidential BOOLEAN DEFAULT TRUE,
    period          VARCHAR(20),                   -- tax period this doc relates to
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 8: INSIGHTS / BLOG CONTENT
-- ============================================================

CREATE TABLE insights (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    slug            VARCHAR(500) UNIQUE NOT NULL,
    category        VARCHAR(100) CHECK (category IN ('tax_update','sme_compliance','budget_analysis','director_strategy','general')),
    summary         TEXT,
    body            TEXT,
    author          VARCHAR(200) DEFAULT 'Capitalstance Advisory Team',
    published_at    DATE,
    status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    views           INT DEFAULT 0,
    featured        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Sample insight entries
INSERT INTO insights (title, slug, category, summary, status, published_at) VALUES
('KRA Digital Service Tax for Foreign Firms', 'kra-digital-service-tax-foreign-firms', 'tax_update', 'What foreign digital service providers in Kenya need to know about registration, rates, and filing.', 'published', '2025-04-01'),
('5 VAT Mistakes That Attract KRA Audits', '5-vat-mistakes-kra-audits', 'sme_compliance', 'The most common VAT errors triggering compliance reviews — and how to avoid them.', 'published', '2025-04-08'),
('Director Loans and Tax Implications', 'director-loans-tax-implications', 'director_strategy', 'How directors extract value from their companies and the tax consequences of each approach.', 'published', '2025-03-15'),
('2025 Finance Bill: Key Provisions for SMEs', '2025-finance-bill-smes', 'budget_analysis', 'A structured breakdown of Finance Bill proposals most likely to affect growing Kenyan businesses.', 'published', '2025-03-01');

-- ============================================================
--  SECTION 9: NEWSLETTER SUBSCRIBERS
-- ============================================================

CREATE TABLE newsletter_subscribers (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(200) UNIQUE NOT NULL,
    first_name      VARCHAR(100),
    subscribed_at   TIMESTAMP DEFAULT NOW(),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','unsubscribed','bounced')),
    source          VARCHAR(50) DEFAULT 'website'
);

-- ============================================================
--  SECTION 10: KRA DISPUTE TRACKER
-- ============================================================

CREATE TABLE kra_disputes (
    id              SERIAL PRIMARY KEY,
    client_id       INT NOT NULL REFERENCES clients(id),
    dispute_ref     VARCHAR(100),                  -- KRA case reference
    dispute_type    VARCHAR(100),                  -- Audit, Assessment, Objection, Appeal
    tax_type        VARCHAR(50),                   -- VAT, PAYE, CIT, etc.
    tax_period      VARCHAR(20),
    amount_disputed DECIMAL(14,2),
    amount_settled  DECIMAL(14,2),
    opened_date     DATE,
    resolved_date   DATE,
    status          VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open','objection_filed','under_review','appeal','settled','closed')),
    summary         TEXT,
    next_action     TEXT,
    next_action_date DATE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  SECTION 11: USEFUL VIEWS
-- ============================================================

-- Active clients with open tax obligations
CREATE VIEW v_pending_obligations AS
SELECT
    c.company_name,
    ct.first_name || ' ' || ct.last_name AS primary_contact,
    ct.phone,
    t.obligation_type,
    t.tax_period,
    t.due_date,
    t.status,
    t.tax_payable
FROM tax_obligations t
JOIN clients c ON c.id = t.client_id
LEFT JOIN contacts ct ON ct.client_id = c.id AND ct.is_primary = TRUE
WHERE t.status IN ('pending','late')
ORDER BY t.due_date ASC;

-- Revenue summary per client
CREATE VIEW v_client_revenue AS
SELECT
    c.id AS client_id,
    c.company_name,
    c.client_type,
    COUNT(DISTINCT e.id) AS active_engagements,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue') THEN i.total_amount ELSE 0 END), 0) AS outstanding
FROM clients c
LEFT JOIN engagements e ON e.client_id = c.id AND e.status = 'active'
LEFT JOIN invoices i ON i.client_id = c.id
LEFT JOIN payments p ON p.client_id = c.id
GROUP BY c.id, c.company_name, c.client_type;

-- Upcoming consultations
CREATE VIEW v_upcoming_consultations AS
SELECT
    con.scheduled_at,
    con.meeting_type,
    con.service_topic,
    con.contact_name,
    con.contact_phone,
    c.company_name,
    con.status
FROM consultations con
LEFT JOIN clients c ON c.id = con.client_id
WHERE con.scheduled_at >= NOW() AND con.status IN ('scheduled','confirmed')
ORDER BY con.scheduled_at ASC;

-- ============================================================
--  SECTION 12: INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_type ON clients(client_type);
CREATE INDEX idx_tax_obligations_due ON tax_obligations(due_date, status);
CREATE INDEX idx_tax_obligations_client ON tax_obligations(client_id);
CREATE INDEX idx_invoices_client ON invoices(client_id, status);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_enquiries_status ON enquiries(status);
CREATE INDEX idx_consultations_scheduled ON consultations(scheduled_at, status);
CREATE INDEX idx_insights_published ON insights(status, published_at DESC);
CREATE INDEX idx_documents_client ON documents(client_id);

-- ============================================================
--  END OF SCHEMA
-- ============================================================
