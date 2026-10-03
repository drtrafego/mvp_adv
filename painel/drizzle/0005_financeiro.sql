-- Honorários do único escritório. Migração manual idempotente, sem envio a clientes.
CREATE TABLE IF NOT EXISTS "cobrancas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_id" uuid NOT NULL REFERENCES "clientes"("id") ON DELETE RESTRICT,
  "descricao" text NOT NULL,
  "valor_centavos" integer NOT NULL,
  "vencimento" date NOT NULL,
  "status" text NOT NULL DEFAULT 'pendente',
  "pago_em" date,
  "criado_por" text NOT NULL,
  "atualizado_por" text NOT NULL,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cobrancas_valor_positivo" CHECK ("valor_centavos" > 0),
  CONSTRAINT "cobrancas_descricao_valida" CHECK (char_length(btrim("descricao")) BETWEEN 1 AND 200),
  CONSTRAINT "cobrancas_status_valido" CHECK ("status" IN ('pendente', 'pago', 'cancelado')),
  CONSTRAINT "cobrancas_pagamento_coerente" CHECK (("status" = 'pago') = ("pago_em" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "idx_cobrancas_vencimento" ON "cobrancas" ("status", "vencimento");
CREATE INDEX IF NOT EXISTS "idx_cobrancas_cliente" ON "cobrancas" ("cliente_id", "vencimento");
