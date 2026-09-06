-- Empresas y comercios que solicitan aparecer como punto de visita en Nómada.
CREATE TABLE IF NOT EXISTS business_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name varchar(160) NOT NULL,
  contact_name varchar(140) NOT NULL,
  email varchar(320) NOT NULL,
  phone varchar(40),
  business_type varchar(80) NOT NULL,
  department varchar(100) NOT NULL,
  municipality varchar(100),
  website varchar(500),
  social_handle varchar(160),
  interest varchar(60) NOT NULL,
  message text,
  consent boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'new',
  admin_notes text,
  contacted_at timestamptz,
  source varchar(60) NOT NULL DEFAULT 'nomada_landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_interests_status_created_idx
  ON business_interests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS business_interests_email_idx
  ON business_interests(email);
