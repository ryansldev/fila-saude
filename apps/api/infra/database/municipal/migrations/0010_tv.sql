CREATE TABLE "tv" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" char(6) NOT NULL,
	"token_hash" text NOT NULL,
	"unidade_id" uuid,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"pareada_em" timestamp with time zone,
	"revogada_em" timestamp with time zone,
	"ultimo_sinal_em" timestamp with time zone,
	CONSTRAINT "tv_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "tv" ADD CONSTRAINT "tv_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tv_codigo_idx" ON "tv" USING btree ("codigo");