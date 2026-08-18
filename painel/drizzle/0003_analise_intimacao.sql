-- Análise ligada à intimação que a originou. Idempotente.
--
-- Sem `comunicacao_id`, a análise de uma intimação não tinha como apontar para ela: o advogado
-- abria a intimação do dia e não achava em lugar nenhum o que o sistema tinha lido. A coluna só
-- vale acompanhada da tool `listar_intimacoes` (devolve o id) e da validação em `salvar_analise`
-- (exige o alvo), senão renasce o mesmo defeito de `prazos.comunicacao_id`.
--
-- `status`: sugerida (padrão) | confirmada | descartada.

ALTER TABLE "analises" ADD COLUMN IF NOT EXISTS "comunicacao_id" uuid REFERENCES "comunicacoes"("id");
ALTER TABLE "analises" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'sugerida';
CREATE INDEX IF NOT EXISTS "idx_analises_comunicacao" ON "analises" ("comunicacao_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_analises_processo" ON "analises" ("processo_id","created_at" DESC);
