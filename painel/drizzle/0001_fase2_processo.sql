CREATE TABLE "anotacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"autor" text DEFAULT 'advogado',
	"criado_em" timestamp with time zone DEFAULT now(),
	"atualizado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"documento" text,
	"tipo_documento" text,
	"email" text,
	"telefone" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fases_processo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"fase" text NOT NULL,
	"fase_anterior" text,
	"motivo" text,
	"autor" text DEFAULT 'advogado',
	"origem" text DEFAULT 'humana',
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processo_partes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"papel" text NOT NULL,
	"principal" boolean DEFAULT false,
	CONSTRAINT "processo_partes_unique" UNIQUE("processo_id","cliente_id","papel")
);
--> statement-breakpoint
CREATE TABLE "sincronizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fonte" text NOT NULL,
	"escopo" text,
	"status" text NOT NULL,
	"itens" integer DEFAULT 0,
	"novos" integer DEFAULT 0,
	"mensagem" text,
	"iniciado_em" timestamp with time zone DEFAULT now(),
	"concluido_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comunicacoes" ADD COLUMN "numero_processo" text;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "categoria" text;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "descricao" text;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "data_documento" date;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD COLUMN "criado_por" text;--> statement-breakpoint
ALTER TABLE "movimentacoes" ADD COLUMN "editado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processos" ADD COLUMN "fase" text DEFAULT 'postulatoria';--> statement-breakpoint
ALTER TABLE "processos" ADD COLUMN "arquivado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processos" ADD COLUMN "excluido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anotacoes" ADD CONSTRAINT "anotacoes_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fases_processo" ADD CONSTRAINT "fases_processo_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_partes" ADD CONSTRAINT "processo_partes_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_partes" ADD CONSTRAINT "processo_partes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_anotacoes_proc" ON "anotacoes" USING btree ("processo_id","criado_em");--> statement-breakpoint
CREATE INDEX "idx_clientes_doc" ON "clientes" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "idx_fases_proc" ON "fases_processo" USING btree ("processo_id","criado_em");--> statement-breakpoint
CREATE INDEX "idx_sinc_fonte" ON "sincronizacoes" USING btree ("fonte","iniciado_em");