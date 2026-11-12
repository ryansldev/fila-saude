ALTER TABLE "unidade" ADD COLUMN "cnes" text;--> statement-breakpoint
ALTER TABLE "unidade" ADD COLUMN "cep" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "unidade" ADD COLUMN "logradouro" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "unidade" ADD COLUMN "numero" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "unidade" ADD COLUMN "complemento" text;--> statement-breakpoint
ALTER TABLE "unidade" ADD COLUMN "bairro" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "unidade" SET "logradouro" = "endereco" WHERE "logradouro" = '';