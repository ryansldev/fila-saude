import { inArray } from "drizzle-orm";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { reservedMunicipalities } from "infra/tenant/reserved";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Limpa antes e depois: uma execução interrompida não deixa o "admin" para a próxima.
const clean = () => database.delete(municipality).where(inArray(municipality.slug, ["admin"]));
beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await clean();
});
afterAll(clean);

// AD-069 / DA12: um município com nome reservado (de antes da regra) sumiria sem aviso; a API avisa ao subir.
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
