CREATE TABLE "pessoa_local" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nascimento" date NOT NULL,
	"cpf" text,
	"paciente_id" text,
	"documento_conferido_por" text,
	"documento_conferido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_local_cpf_unico" ON "pessoa_local" USING btree ("cpf") WHERE "pessoa_local"."cpf" is not null;