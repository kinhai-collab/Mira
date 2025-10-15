-- enable extensions if not already (run as superuser once)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- login identity
  email TEXT,                   -- nullable if user created via provider that doesn't return email
  name TEXT NOT NULL,
  password_hash TEXT,           -- bcrypt/argon2 hash; can be NULL for OAuth-only accounts

  -- OAuth / social login support
  provider TEXT,                -- e.g. 'local', 'google', 'apple'
  provider_user_id TEXT,        -- provider's user id (sub) to identify the external account
  provider_data JSONB,          -- provider response / metadata if you want to store it

  -- flags & metadata
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes & constraints
-- Ensure only one user per provider/provider_user_id
CREATE UNIQUE INDEX ux_app_user_provider_provider_user_id
  ON app_user(provider, provider_user_id)
  WHERE provider IS NOT NULL AND provider_user_id IS NOT NULL;

-- Ensure email uniqueness when provided 
CREATE UNIQUE INDEX ux_app_user_email ON app_user(LOWER(email))
  WHERE email IS NOT NULL;

--ensure local accounts must have password_hash
ALTER TABLE app_user
  ADD CONSTRAINT chk_local_password_required
    CHECK (provider IS DISTINCT FROM 'local' OR (password_hash IS NOT NULL));