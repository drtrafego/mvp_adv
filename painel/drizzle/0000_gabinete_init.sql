CREATE TABLE "analises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid,
	"documento_id" uuid,
	"tipo" text NOT NULL,
	"conteudo" jsonb NOT NULL,
	"versao" integer DEFAULT 1,
	"origem" text DEFAULT 'maquina',
	"editado_por" text,
	"editado_em" timestamp with time zone,
	"modelo" text,
	"tokens_input" integer,
	"tokens_output" integer,
	"custo_usd" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comunicacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid,
	"hash_djen" text,
	"tipo" text,
	"meio" text DEFAULT 'DJEN',
	"inteiro_teor" text,
	"data_disponibilizacao" date,
	"data_publicacao" date,
	"oab_destino" text,
	"processada" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "comunicacoes_hash_djen_unique" UNIQUE("hash_djen")
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid,
	"titulo" text,
	"tipo" text,
	"storage_path" text NOT NULL,
	"paginas" integer,
	"hash_sha256" text,
	"texto_extraido" boolean DEFAULT false,
	"fonte" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feriados_forenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tribunal" text NOT NULL,
	"data" date NOT NULL,
	"descricao" text,
	"tipo" text DEFAULT 'feriado',
	CONSTRAINT "feriado_unique" UNIQUE("tribunal","data")
);
--> statement-breakpoint
CREATE TABLE "movimentacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid,
	"codigo_cnj" integer,
	"descricao" text NOT NULL,
	"data_hora" timestamp with time zone NOT NULL,
	"complemento" jsonb,
	"fonte" text DEFAULT 'datajud',
	CONSTRAINT "mov_unique" UNIQUE("processo_id","codigo_cnj","data_hora")
);
--> statement-breakpoint
CREATE TABLE "prazos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid,
	"comunicacao_id" uuid,
	"ato" text NOT NULL,
	"regra_aplicada" text,
	"dias" integer,
	"contagem" text DEFAULT 'uteis',
	"data_publicacao" date,
	"data_inicio" date,
	"data_fatal_sugerida" date NOT NULL,
	"data_fatal" date NOT NULL,
	"status" text DEFAULT 'sugerido',
	"origem" text DEFAULT 'maquina',
	"justificativa_ia" text,
	"divergencia" jsonb,
	"editado_por" text,
	"editado_em" timestamp with time zone,
	"alertas_enviados" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_cnj" text NOT NULL,
	"tribunal" text NOT NULL,
	"classe" text,
	"assunto" text,
	"orgao_julgador" text,
	"valor_causa" numeric,
	"grau" text,
	"partes" jsonb,
	"cliente_nome" text,
	"status" text DEFAULT 'ativo',
	"ultima_sincronizacao" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "processos_numero_cnj_unique" UNIQUE("numero_cnj")
);
--> statement-breakpoint
ALTER TABLE "analises" ADD CONSTRAINT "analises_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analises" ADD CONSTRAINT "analises_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicacoes" ADD CONSTRAINT "comunicacoes_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_comunicacao_id_comunicacoes_id_fk" FOREIGN KEY ("comunicacao_id") REFERENCES "public"."comunicacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comunic_proc" ON "comunicacoes" USING btree ("processada");--> statement-breakpoint
CREATE INDEX "idx_mov_proc" ON "movimentacoes" USING btree ("processo_id","data_hora");--> statement-breakpoint
CREATE INDEX "idx_prazos_fatal" ON "prazos" USING btree ("data_fatal","status");