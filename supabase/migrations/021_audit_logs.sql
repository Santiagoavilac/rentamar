-- Fase 3 — Auditoría central append-only de acciones administrativas.
-- La escritura la hacen las RPC SECURITY DEFINER y el server (cliente admin).
-- No debe contener secretos ni PII innecesaria: el sanitizado ocurre en la capa
-- de aplicación (src/lib/audit.ts) antes de escribir before_data/after_data.
-- La IP se guarda hasheada/truncada, nunca completa.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id text,
  ip_hash text,
  user_agent_summary text,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_created_idx on public.audit_logs (created_at);
