-- PROPOSTA de migração adicional. Revisar com o schema/HEAD atual; NÃO aplicada.
-- Não substitui as migrações existentes de processos/prazos/peças/clientes/honorários.
BEGIN;

CREATE TABLE office_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  sector text NOT NULL,
  role_description text NOT NULL,
  personality_description text NOT NULL DEFAULT '',
  practice_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  appearance jsonb NOT NULL DEFAULT '{}'::jsonb,
  station jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 80)
);

CREATE TABLE office_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  job_type text NOT NULL,
  agent_id uuid REFERENCES office_agents(id),
  context_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_version integer NOT NULL DEFAULT 1,
  input jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','running','waiting_human','waiting_external','succeeded','failed','cancelled')),
  priority integer NOT NULL DEFAULT 100,
  resource_class text NOT NULL DEFAULT 'light' CHECK (resource_class IN ('light','heavy')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_until timestamptz,
  result_refs jsonb,
  error_code text,
  requested_by_service text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK ((lease_owner IS NULL) = (lease_until IS NULL))
);
CREATE INDEX office_jobs_claim ON office_jobs (resource_class, priority, available_at)
  WHERE state='queued';
CREATE INDEX office_jobs_lease ON office_jobs (lease_until) WHERE state='running';

CREATE TABLE office_job_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES office_jobs(id),
  event_type text NOT NULL,
  actor_service text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX office_job_events_job ON office_job_events(job_id,seq);

CREATE TABLE office_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  payload_sha256 char(64) NOT NULL,
  private_payload_ref text NOT NULL,
  state text NOT NULL DEFAULT 'received' CHECK (state IN ('received','processing','processed','quarantined','failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE office_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  job_id uuid REFERENCES office_jobs(id),
  channel text NOT NULL,
  recipient_ref text NOT NULL,
  recipient_version text NOT NULL,
  content_ref text NOT NULL,
  content_sha256 char(64) NOT NULL,
  authorized_policy_ref text NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','claimed','sent','delivered','uncertain','failed','cancelled')),
  provider_message_id text,
  attempts integer NOT NULL DEFAULT 0,
  not_before timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX office_outbox_claim ON office_outbox(not_before) WHERE state='pending';

CREATE TABLE office_calendar_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  lawyer_ref text NOT NULL,
  calendar_ref text NOT NULL,
  client_ref text NOT NULL,
  hearing_ref text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','confirmed','expired','cancelled','uncertain')),
  expires_at timestamptz NOT NULL,
  provider_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at > starts_at)
);
CREATE UNIQUE INDEX office_calendar_provider_event ON office_calendar_holds(calendar_ref,provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX office_calendar_hold_lookup ON office_calendar_holds(lawyer_ref,starts_at,ends_at,state);

-- A reserva deve adquirir lock transacional por advogado/agenda e consultar sobreposição
-- antes do insert; este DDL sozinho NÃO impede dois holds simultâneos sobrepostos.
-- A aplicação ainda revalida o provedor antes da confirmação.
COMMIT;
