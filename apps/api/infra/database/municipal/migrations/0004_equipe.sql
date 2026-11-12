CREATE TYPE "public"."funcao" AS ENUM('gestao_sms', 'regulacao_sms', 'gerente_ubs', 'agendar');--> statement-breakpoint
CREATE TYPE "public"."ocupacao" AS ENUM('medico', 'enfermeiro', 'tecnico_enfermagem', 'cirurgiao_dentista', 'auxiliar_saude_bucal', 'acs', 'recepcao', 'farmaceutico', 'psicologo', 'fisioterapeuta', 'nutricionista', 'assistente_social');--> statement-breakpoint
CREATE TABLE "funcao_usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"funcao" "funcao" NOT NULL,
	"unidade_id" uuid,
	"concedido_por" text,
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funcao_usuario_unica" UNIQUE NULLS NOT DISTINCT("usuario_id","funcao","unidade_id"),
	CONSTRAINT "funcao_usuario_escopo" CHECK (("funcao_usuario"."funcao" in ('gestao_sms', 'regulacao_sms')) = ("funcao_usuario"."unidade_id" is null))
);
--> statement-breakpoint
CREATE TABLE "vinculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"unidade_id" uuid NOT NULL,
	"ocupacao" "ocupacao" NOT NULL,
	"concedido_por" text,
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vinculo_unico" UNIQUE("usuario_id","unidade_id","ocupacao")
);
--> statement-breakpoint
ALTER TABLE "funcao_usuario" ADD CONSTRAINT "funcao_usuario_usuario_id_usuario_painel_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario_painel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcao_usuario" ADD CONSTRAINT "funcao_usuario_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_usuario_id_usuario_painel_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario_painel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "funcao_usuario" ("usuario_id", "funcao", "unidade_id", "concedido_por", "concedido_em")
SELECT "usuario_id", (CASE "perfil"::text WHEN 'gestor' THEN 'gestao_sms' WHEN 'admin' THEN 'gerente_ubs' ELSE 'agendar' END)::"funcao", "unidade_id", "concedido_por", "concedido_em"
FROM "perfil_usuario" WHERE "perfil" IN ('gestor', 'admin', 'agendador');
--> statement-breakpoint
INSERT INTO "vinculo" ("usuario_id", "unidade_id", "ocupacao", "concedido_por", "concedido_em")
SELECT "usuario_id", "unidade_id", (CASE "perfil"::text WHEN 'recepcao' THEN 'recepcao' WHEN 'triagem' THEN 'enfermeiro' ELSE 'medico' END)::"ocupacao", "concedido_por", "concedido_em"
FROM "perfil_usuario" WHERE "perfil" IN ('recepcao', 'triagem', 'profissional')
ON CONFLICT DO NOTHING;
