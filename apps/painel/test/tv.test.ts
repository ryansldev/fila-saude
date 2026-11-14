import { describe, expect, it } from "vitest";
import { ANUNCIOS_VAZIOS, avancarAnuncios, receberChamadas } from "@/lib/tv";

const ch = (senha: string, em: number) => ({
  id: `${senha}:${em}`,
  senha,
  destino: "Sala 1",
  em: new Date(em).toISOString(),
});

describe("fila de anúncios da TV (RN-TV-07, RN-TV-04)", () => {
  it("na primeira leitura só guarda o histórico, sem anunciar nem tocar", () => {
    const e = receberChamadas(ANUNCIOS_VAZIOS, [ch("C-002", 2), ch("C-001", 1)]);
    expect(e.fila).toEqual([]);
    expect(e.vistas).toEqual(["C-002:2", "C-001:1"]);
  });

  it("duas chamadas juntas entram em fila, a mais antiga primeiro; cada uma fica o tempo do destaque", () => {
    let e = receberChamadas(ANUNCIOS_VAZIOS, []);
    e = receberChamadas(e, [ch("C-002", 2), ch("C-001", 1)]);
    expect(e.fila.map((c) => c.senha)).toEqual(["C-001", "C-002"]);

    const a = avancarAnuncios(e, 1000, 10_000);
    expect(a.tocar).toBe(true);
    expect(a.estado.atual?.chamada.senha).toBe("C-001");

    const b = avancarAnuncios(a.estado, 5000, 10_000);
    expect(b.tocar).toBe(false);
    expect(b.estado.atual?.chamada.senha).toBe("C-001");

    const c = avancarAnuncios(b.estado, 11_000, 10_000);
    expect(c.tocar).toBe(true);
    expect(c.estado.atual?.chamada.senha).toBe("C-002");

    const d = avancarAnuncios(c.estado, 21_000, 10_000);
    expect(d.tocar).toBe(false);
    expect(d.estado.atual).toBeNull();
  });

  it("rechamada é uma chamada nova (outro horário) e é anunciada de novo; a já vista não volta", () => {
    let e = receberChamadas(ANUNCIOS_VAZIOS, [ch("C-001", 1)]);
    e = receberChamadas(e, [ch("C-001", 1)]);
    expect(e.fila).toEqual([]);
    e = receberChamadas(e, [ch("C-001", 5), ch("C-001", 1)]);
    expect(e.fila.map((c) => c.id)).toEqual(["C-001:5"]);
  });
});
