CREATE TABLE "dia_sessao" (
	"sessao_id" uuid PRIMARY KEY NOT NULL,
	"dia" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dia_sessao" ADD CONSTRAINT "dia_sessao_sessao_id_sessao_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessao"("id") ON DELETE no action ON UPDATE no action;