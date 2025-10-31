-- Credentials & sync state
create table if not exists public.google_calendar_credentials (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  expiry timestamptz not null,
  scope text not null,
  token_type text not null,
  next_sync_token text,
  channel_id text,
  resource_id text,
  channel_expiration timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PKCE scratch state
create table if not exists public.oauth_pkce_state (
  state text primary key,
  code_verifier text not null,
  uid uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Keep RLS ON; deny direct client access (backend uses service role)
alter table public.google_calendar_credentials enable row level security;
alter table public.oauth_pkce_state enable row level security;
create policy "service only creds" on public.google_calendar_credentials
  for all using (false) with check (false);
create policy "service only pkce" on public.oauth_pkce_state
  for all using (false) with check (false);