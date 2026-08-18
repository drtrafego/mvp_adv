-- Partes detectadas e pasta do cliente. Idempotente.
--
-- A API Publica do DataJud nao devolve as partes do processo, entao `processos.partes` (jsonb)
-- nasceu sem fonte e esta NULL nos 51 processos: e coluna morta, marcada como DEPRECADA aqui.
-- A unica fonte estruturada de parte hoje e `comunicacoes.destinatarios` ([{nome, polo}], A =
-- ativo, P = passivo), mais a qualificacao no inteiro teor da intimacao.
--
-- `partes_detectadas` guarda o que a maquina reconheceu, com a regra de ouro do projeto: quando
-- todas as comunicacoes do processo intimam UM UNICO POLO, a identificacao e segura e o cliente
-- e gravado como sugestao (amarelo). Quando ha destinatario dos DOIS polos, nada e gravado em
-- `clientes` nem em `processo_partes` e a deteccao fica esperando o advogado decidir. Exibir a
-- parte contraria como cliente e pior que campo vazio.
--
-- Valores: fonte = djen_destinatario | teor_intimacao | manual
--          confianca = alta | media | baixa
--          status = sugerido | confirmado | descartado

CREATE TABLE IF NOT EXISTS "partes_detectadas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "processo_id" uuid NOT NULL REFERENCES "processos"("id") ON DELETE CASCADE,
  "comunicacao_id" uuid REFERENCES "comunicacoes"("id"),
  "nome" text NOT NULL,
  "nome_chave" text NOT NULL,
  "polo" text,
  "papel_sugerido" text,
  "fonte" text NOT NULL,
  "confianca" text NOT NULL DEFAULT 'baixa',
  "e_cliente_sugerido" boolean NOT NULL DEFAULT false,
  "justificativa" text,
  "trecho_fonte" text,
  "status" text NOT NULL DEFAULT 'sugerido',
  "cliente_id" uuid REFERENCES "clientes"("id"),
  "decidido_por" text,
  "decidido_em" timestamptz,
  "criado_em" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "partes_detectadas_unica"
  ON "partes_detectadas" ("processo_id","nome_chave",coalesce("polo",''));

CREATE INDEX IF NOT EXISTS "idx_partes_det_fila"
  ON "partes_detectadas" ("status","confianca","criado_em");

-- As linhas que ja existem em processo_partes nasceram de decisao humana, entao o default
-- 'humana' e o valor correto para elas.
ALTER TABLE "processo_partes" ADD COLUMN IF NOT EXISTS "origem" text DEFAULT 'humana';
ALTER TABLE "processo_partes" ADD COLUMN IF NOT EXISTS "polo" text;
ALTER TABLE "processo_partes" ADD COLUMN IF NOT EXISTS "confirmado_por" text;
ALTER TABLE "processo_partes" ADD COLUMN IF NOT EXISTS "confirmado_em" timestamptz;

-- Documento na pasta do cliente. So e preenchido a partir de vinculo confirmado por humano:
-- documento na pasta do cliente errado e vazamento, e com segredo de justica o custo e outro.
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "cliente_id" uuid REFERENCES "clientes"("id");
CREATE INDEX IF NOT EXISTS "idx_docs_cliente" ON "documentos" ("cliente_id","categoria","created_at");

COMMENT ON COLUMN "processos"."partes" IS
  'DEPRECADA: a API Publica do DataJud nao devolve partes. Use partes_detectadas.';
