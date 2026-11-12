ALTER TABLE "user" RENAME TO "paciente";--> statement-breakpoint
ALTER TABLE "paciente" DROP CONSTRAINT "user_email_unique";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "cpf" text NOT NULL;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "nascimento" date NOT NULL;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "telefone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "verificado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "verificado_metodo" text;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "verificado_municipio" uuid;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_paciente_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_paciente_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_cpf_unique" UNIQUE("cpf");