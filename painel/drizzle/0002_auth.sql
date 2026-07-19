-- Autenticacao do painel (um advogado, nao SaaS). Idempotente.

CREATE TABLE IF NOT EXISTS "usuarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "senha_hash" text NOT NULL,
  "nome" text,
  "oab" text,
  "criado_em" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expira_em" timestamptz NOT NULL,
  "criado_em" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sessoes_usuario" ON "sessoes" ("usuario_id");
