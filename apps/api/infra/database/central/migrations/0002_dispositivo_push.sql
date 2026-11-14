CREATE TABLE "dispositivo_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" text NOT NULL,
	"token" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispositivo_push_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "dispositivo_push" ADD CONSTRAINT "dispositivo_push_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;