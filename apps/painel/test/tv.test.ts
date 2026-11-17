import { describe, expect, it } from "vitest";
import { advanceAnnouncements, EMPTY_ANNOUNCEMENTS, lastAnnounced, receiveCalls } from "@/lib/tv";

const ch = (ticket: string, at: number) => ({
  id: `${ticket}:${at}`,
  ticket,
  destination: "Sala 1",
  at: new Date(at).toISOString(),
});

describe("fila de anúncios da TV (RN-TV-07, RN-TV-04)", () => {
  it("na primeira leitura só guarda o histórico, sem anunciar nem tocar", () => {
    const e = receiveCalls(EMPTY_ANNOUNCEMENTS, [ch("C-002", 2), ch("C-001", 1)]);
    expect(e.queue).toEqual([]);
    expect(e.seen).toEqual(["C-002:2", "C-001:1"]);
  });

  it("duas chamadas juntas entram em fila, a mais antiga primeiro; cada uma fica o tempo do destaque", () => {
    let e = receiveCalls(EMPTY_ANNOUNCEMENTS, []);
    e = receiveCalls(e, [ch("C-002", 2), ch("C-001", 1)]);
    expect(e.queue.map((c) => c.ticket)).toEqual(["C-001", "C-002"]);

    const a = advanceAnnouncements(e, 1000, 10_000);
    expect(a.tap).toBe(true);
    expect(a.state.current?.call.ticket).toBe("C-001");

    const b = advanceAnnouncements(a.state, 5000, 10_000);
    expect(b.tap).toBe(false);
    expect(b.state.current?.call.ticket).toBe("C-001");

    const c = advanceAnnouncements(b.state, 11_000, 10_000);
    expect(c.tap).toBe(true);
    expect(c.state.current?.call.ticket).toBe("C-002");

    const d = advanceAnnouncements(c.state, 21_000, 10_000);
    expect(d.tap).toBe(false);
    expect(d.state.current).toBeNull();
  });

  it("rechamada é uma chamada nova (outro horário) e é anunciada de novo; a já vista não volta", () => {
    let e = receiveCalls(EMPTY_ANNOUNCEMENTS, [ch("C-001", 1)]);
    e = receiveCalls(e, [ch("C-001", 1)]);
    expect(e.queue).toEqual([]);
    e = receiveCalls(e, [ch("C-001", 5), ch("C-001", 1)]);
    expect(e.queue.map((c) => c.id)).toEqual(["C-001:5"]);
  });
});

describe("TV (revisão 2026-11-13)", () => {
  it("depois de reconectar, chamada velha não é anunciada de novo (só entra no histórico)", () => {
    let e = receiveCalls(EMPTY_ANNOUNCEMENTS, []);
    const now = 100_000;
    e = receiveCalls(e, [ch("C-009", now - 1000), ch("C-008", now - 60_000)], now, 20_000);
    expect(e.queue.map((c) => c.ticket)).toEqual(["C-009"]);
    expect(e.seen).toContain("C-008:40000");
  });

  it("'últimas chamadas' só mostra o que já foi anunciado", () => {
    let e = receiveCalls(EMPTY_ANNOUNCEMENTS, [ch("C-001", 1)]);
    e = receiveCalls(e, [ch("C-003", 3), ch("C-002", 2), ch("C-001", 1)]);
    const a = advanceAnnouncements(e, 10, 10_000).state; // C-002 em destaque, C-003 na fila
    expect(lastAnnounced(a, [ch("C-003", 3), ch("C-002", 2), ch("C-001", 1)]).map((c) => c.ticket)).toEqual(["C-001"]);
  });
});
