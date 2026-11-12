CREATE TYPE "public"."estado_entrada" AS ENUM('aguardando_encaminhamento', 'aguardando', 'alocada', 'confirmada', 'na_reserva', 'na_fila', 'remanejada', 'arquivada', 'concluida', 'cancelada', 'encerrada_sem_atendimento');--> statement-breakpoint
CREATE TYPE "public"."nivel_risco" AS ENUM('emergencia', 'urgente', 'atencao', 'rotina');--> statement-breakpoint
CREATE TYPE "public"."origem_remanejada" AS ENUM('privada', 'publica', 'regulada');--> statement-breakpoint
CREATE TYPE "public"."etapa" AS ENUM('triagem', 'atendimento');--> statement-breakpoint
CREATE TYPE "public"."perfil_painel" AS ENUM('gestor', 'admin', 'agendador', 'recepcao', 'triagem', 'profissional');--> statement-breakpoint
CREATE TYPE "public"."modo_servico" AS ENUM('livre', 'requisicao', 'regulado');--> statement-breakpoint
CREATE TYPE "public"."estado_sessao" AS ENUM('planejada', 'aberta', 'cancelada', 'encerrada');--> statement-breakpoint
CREATE TYPE "public"."visibilidade_sessao" AS ENUM('publica', 'privada');--> statement-breakpoint
CREATE TYPE "public"."tipo_unidade" AS ENUM('ubs', 'policlinica', 'upa');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"acao" text NOT NULL,
	"alvo_tipo" text NOT NULL,
	"alvo_id" text NOT NULL,
	"unidade_id" uuid,
	"motivo" text,
	"dados" jsonb,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conta_painel" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessao_painel" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessao_painel_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuario_painel" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_painel_email_unique" UNIQUE("email"),
	CONSTRAINT "usuario_painel_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verificacao_painel" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrada" (
	"id" uuid PRIMARY KEY NOT NULL,
	"servico_id" uuid NOT NULL,
	"pessoa_local_id" uuid NOT NULL,
	"responsavel_paciente_id" text,
	"estado" "estado_entrada" NOT NULL,
	"data_entrada_original" timestamp with time zone NOT NULL,
	"classificacao" jsonb NOT NULL,
	"risco_confirmado" "nivel_risco",
	"prioridade" jsonb NOT NULL,
	"remanejada" "origem_remanejada",
	"recusas" integer DEFAULT 0 NOT NULL,
	"sessao_id" uuid,
	"alocada_em" timestamp with time zone,
	"perguntado_em" timestamp with time zone,
	"respondido_em" timestamp with time zone,
	"arquivada_em" timestamp with time zone,
	"sessoes_recusadas" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"versao" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unidade_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"etapa" "etapa" NOT NULL,
	"aberta" boolean DEFAULT false NOT NULL,
	"ultimo_sinal_em" timestamp with time zone,
	"arquivada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estacao_servico" (
	"estacao_id" uuid NOT NULL,
	"servico_id" uuid NOT NULL,
	CONSTRAINT "estacao_servico_estacao_id_servico_id_pk" PRIMARY KEY("estacao_id","servico_id")
);
--> statement-breakpoint
CREATE TABLE "perfil_usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"perfil" "perfil_painel" NOT NULL,
	"unidade_id" uuid,
	"concedido_por" text,
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perfil_usuario_unico" UNIQUE NULLS NOT DISTINCT("usuario_id","perfil","unidade_id"),
	CONSTRAINT "perfil_usuario_escopo" CHECK (("perfil_usuario"."perfil" = 'gestor') = ("perfil_usuario"."unidade_id" is null))
);
--> statement-breakpoint
CREATE TABLE "servico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unidade_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"prefixo" text NOT NULL,
	"exige_triagem" boolean DEFAULT false NOT NULL,
	"modo" "modo_servico" DEFAULT 'livre' NOT NULL,
	"tempo_medio_triagem_min" integer,
	"tempo_medio_atendimento_min" integer DEFAULT 15 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servico_prefixo_unico" UNIQUE("unidade_id","prefixo"),
	CONSTRAINT "servico_prefixo_formato" CHECK ("servico"."prefixo" ~ '^[A-Z]{1,3}$')
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servico_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	"vagas" integer,
	"ocupadas" integer DEFAULT 0 NOT NULL,
	"visibilidade" "visibilidade_sessao" DEFAULT 'privada' NOT NULL,
	"dispensa_pre_cadastro" boolean DEFAULT false NOT NULL,
	"profissional" text,
	"estado" "estado_sessao" DEFAULT 'planejada' NOT NULL,
	"versao" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessao_fim_depois" CHECK ("sessao"."fim" > "sessao"."inicio"),
	CONSTRAINT "sessao_vagas_minimo" CHECK ("sessao"."vagas" is null or "sessao"."vagas" >= 1),
	CONSTRAINT "sessao_ocupadas" CHECK ("sessao"."ocupadas" >= 0 and ("sessao"."vagas" is null or "sessao"."ocupadas" <= "sessao"."vagas")),
	CONSTRAINT "sessao_dispensa_publica" CHECK (not "sessao"."dispensa_pre_cadastro" or "sessao"."visibilidade" = 'publica')
);
--> statement-breakpoint
CREATE TABLE "sessao_estacao" (
	"sessao_id" uuid NOT NULL,
	"estacao_id" uuid NOT NULL,
	CONSTRAINT "sessao_estacao_sessao_id_estacao_id_pk" PRIMARY KEY("sessao_id","estacao_id")
);
--> statement-breakpoint
CREATE TABLE "unidade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_unidade" DEFAULT 'ubs' NOT NULL,
	"endereco" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"fuso" text NOT NULL,
	"horario" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conta_painel" ADD CONSTRAINT "conta_painel_user_id_usuario_painel_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuario_painel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao_painel" ADD CONSTRAINT "sessao_painel_user_id_usuario_painel_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuario_painel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_servico_id_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_pessoa_local_id_pessoa_local_id_fk" FOREIGN KEY ("pessoa_local_id") REFERENCES "public"."pessoa_local"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_sessao_id_sessao_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacao" ADD CONSTRAINT "estacao_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacao_servico" ADD CONSTRAINT "estacao_servico_estacao_id_estacao_id_fk" FOREIGN KEY ("estacao_id") REFERENCES "public"."estacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacao_servico" ADD CONSTRAINT "estacao_servico_servico_id_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfil_usuario" ADD CONSTRAINT "perfil_usuario_usuario_id_usuario_painel_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario_painel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfil_usuario" ADD CONSTRAINT "perfil_usuario_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servico" ADD CONSTRAINT "servico_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_servico_id_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao_estacao" ADD CONSTRAINT "sessao_estacao_sessao_id_sessao_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao_estacao" ADD CONSTRAINT "sessao_estacao_estacao_id_estacao_id_fk" FOREIGN KEY ("estacao_id") REFERENCES "public"."estacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conta_painel_user_idx" ON "conta_painel" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessao_painel_user_idx" ON "sessao_painel" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entrada_ativa_unica" ON "entrada" USING btree ("servico_id","pessoa_local_id") WHERE "entrada"."estado" not in ('cancelada','concluida','encerrada_sem_atendimento','arquivada');