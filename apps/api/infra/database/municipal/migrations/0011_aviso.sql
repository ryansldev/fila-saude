CREATE TABLE "aviso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" text NOT NULL,
	"paciente_id" text NOT NULL,
	"entrada_id" uuid,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"corpo" text NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"proxima_tentativa_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_erro" text,
	"enviado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aviso_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE INDEX "aviso_pendente_idx" ON "aviso" USING btree ("estado","proxima_tentativa_em");