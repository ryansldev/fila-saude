-- NC5: UNLOGGED (escrito à mão; o drizzle-kit não gera): contagens de minutos ficam fora do WAL, do backup e das réplicas.
CREATE UNLOGGED TABLE "attempt" (
	"key" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attempt_expires_at_idx" ON "attempt" USING btree ("expires_at");