-- Viajeros que desean recibir acceso temprano y formar parte de Nómada.
CREATE TABLE IF NOT EXISTS traveler_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(140) NOT NULL,
  email varchar(320) NOT NULL,
  phone varchar(40),
  department varchar(100),
  traveler_style varchar(60),
  consent boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'new',
  source varchar(60) NOT NULL DEFAULT 'nomada_landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS traveler_interests_email_uq ON traveler_interests(email);
CREATE INDEX IF NOT EXISTS traveler_interests_status_created_idx ON traveler_interests(status, created_at DESC);
