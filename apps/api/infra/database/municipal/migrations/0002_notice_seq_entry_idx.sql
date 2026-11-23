-- AD-074: `seq` é a ordem de gravação dos avisos. Os que já existem recebem a ordem de `created_at` (depois o id),
-- não a ordem física da tabela; os novos seguem a sequência a partir do maior.
ALTER TABLE "notice" ADD COLUMN "seq" bigint;--> statement-breakpoint
UPDATE "notice" SET "seq" = r."n" FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "n" FROM "notice") r WHERE "notice"."id" = r."id";--> statement-breakpoint
ALTER TABLE "notice" ALTER COLUMN "seq" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notice" ALTER COLUMN "seq" ADD GENERATED ALWAYS AS IDENTITY (sequence name "notice_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
SELECT setval('"notice_seq_seq"', COALESCE((SELECT max("seq") FROM "notice"), 0) + 1, false);--> statement-breakpoint
CREATE INDEX "notice_entry_idx" ON "notice" USING btree ("entry_id");
