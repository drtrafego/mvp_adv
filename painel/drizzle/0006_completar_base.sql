-- Completa a trilha SQL para os recursos que antes existiam apenas no schema monolitico.
-- Seguro repetir em bancos que ja possuem estas tabelas e colunas.
-- Nao remove tabelas, colunas, arquivos ou registros.

CREATE TABLE IF NOT EXISTS "modelos_peca" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "texto_extraido" text,
  "arquivo_nome" text,
  "storage_path" text,
  "tags" text[] DEFAULT '{}',
  "ativo" boolean DEFAULT true,
  "criado_em" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_modelos_tipo" ON "modelos_peca" ("tipo");

CREATE TABLE IF NOT EXISTS "pecas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "processo_id" uuid REFERENCES "processos"("id") ON DELETE CASCADE,
  "prazo_id" uuid REFERENCES "prazos"("id") ON DELETE SET NULL,
  "cliente_id" uuid REFERENCES "clientes"("id") ON DELETE SET NULL,
  "modelo_base_id" uuid REFERENCES "modelos_peca"("id"),
  "tipo" text NOT NULL,
  "titulo" text,
  "conteudo" text,
  "status" text DEFAULT 'pendente',
  "origem" text DEFAULT 'maquina',
  "versao" integer DEFAULT 1,
  "editado_por" text,
  "editado_em" timestamptz,
  "criado_em" timestamptz DEFAULT now(),
  "atualizado_em" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_pecas_processo" ON "pecas" ("processo_id", "criado_em");

ALTER TABLE "anotacoes" ALTER COLUMN "processo_id" DROP NOT NULL;
ALTER TABLE "anotacoes" ADD COLUMN IF NOT EXISTS "cliente_id" uuid REFERENCES "clientes"("id") ON DELETE CASCADE;
ALTER TABLE "anotacoes" ADD COLUMN IF NOT EXISTS "prazo_id" uuid REFERENCES "prazos"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_anotacoes_cliente" ON "anotacoes" ("cliente_id", "criado_em");
CREATE INDEX IF NOT EXISTS "idx_anotacoes_prazo" ON "anotacoes" ("prazo_id", "criado_em");

ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "arquivo_nome" text;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "tamanho_bytes" bigint;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "texto" text;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "extracao_status" text DEFAULT 'pendente';
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "extraido_em" timestamptz;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "enviado_por" text;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "excluido_em" timestamptz;
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "peca_id" uuid REFERENCES "pecas"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_docs_proc" ON "documentos" ("processo_id", "categoria", "created_at");
CREATE INDEX IF NOT EXISTS "idx_docs_peca" ON "documentos" ("peca_id", "categoria", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "documentos_hash_unico"
  ON "documentos" ("processo_id", "hash_sha256")
  WHERE "hash_sha256" IS NOT NULL AND "excluido_em" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_hash_peca_unico"
  ON "documentos" ("peca_id", "hash_sha256")
  WHERE "peca_id" IS NOT NULL AND "hash_sha256" IS NOT NULL AND "excluido_em" IS NULL;

ALTER TABLE "comunicacoes" ADD COLUMN IF NOT EXISTS "destinatarios" jsonb;
