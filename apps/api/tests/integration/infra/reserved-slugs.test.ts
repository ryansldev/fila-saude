import { inArray } from "drizzle-orm";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { reservedMunicipalities } from "infra/tenant/reserved";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

beforeAll(() => orchestrator.waitForAllServices());
afterAll(() => database.delete(municipality).where(inArray(municipality.slug, ["admin"])));

// AD-069 / DA12: um município com nome reservado (de antes da regra) sumiria sem aviso; a API recusa subir.
describe("municípios com nome reservado no catálogo", () => {
  it("sem nenhum: lista vazia", async () => {
    expect(await reservedMunicipalities(database)).toEqual([]);
  });

  it("acha o município com nome reservado", async () => {
    await database
      .insert(municipality)
      .values({ slug: "admin", name: "Antigo", uf: "SP", databaseRef: "template:fila_t_admin", status: "active" });
    expect(await reservedMunicipalities(database)).toEqual(["admin"]);
  });
});
