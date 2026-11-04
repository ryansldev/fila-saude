const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.UTC(2026, 10, 12, 10, 0); // 12/11/2026 07:00 em Brasília

const none = { alarms: [], motivo: "exame", gravidade: null, condicoes: [], grupos: [] };
const answers = (over) => ({ ...none, ...over });

function baseState(extra = {}) {
  return E.createState({
    now: NOW,
    services: [
      { id: "cli", unitId: "u1", name: "Clínico geral", prefix: "C", requiresReferral: false },
      { id: "car", unitId: "u1", name: "Cardiologia", prefix: "K", requiresReferral: true },
    ],
    patients: [
      { id: "ana", name: "Ana", sexo: "F", birth: "1990-01-01" },
      { id: "joao", name: "João", sexo: "M", birth: "1990-01-01" },
      { id: "bruno", name: "Bruno", sexo: "M", birth: "1990-01-01" },
      { id: "dora", name: "Dora", sexo: "F", birth: "1944-03-01" },
      { id: "edu", name: "Edu", sexo: "M", birth: "1990-01-01" },
    ],
    sessions: [{ id: "s1", serviceId: "cli", start: NOW + DAY, slots: 3, visibility: "privada" }],
    stations: [{ id: "st1", name: "Consultório 3", services: ["cli"], open: true }],
    ...extra,
  });
}

// Coloca uma lista de pacientes confirmados na sessão, na ordem dada (data original crescente).
function confirmedSession(ids, { slots = 10 } = {}) {
  const st = baseState();
  st.sessions[0].slots = slots;
  ids.forEach((pid, i) => {
    st.now = NOW - (ids.length - i) * DAY;
    const r = E.createEntry(st, { patientId: pid, serviceId: "cli", answers: none });
    assert.equal(r.ok, true);
  });
  st.now = NOW;
  const entries = ids.map((pid) => st.entries.find((e) => e.patientId === pid));
  const res = E.allocate(
    st,
    "s1",
    entries.map((e) => e.id),
    { version: st.sessions[0].version },
  );
  assert.equal(res.ok, true);
  for (const e of entries) E.confirmAllocation(st, e.id);
  E.openSession(st, "s1");
  return st;
}

const item = (st, pid) => st.sessions[0].queue.find((q) => q.patientId === pid);
const order = (st) => E.callOrder(st, "s1", "st1").map((q) => q.patientId);
const checkIn = (st, pid) => E.checkIn(st, "s1", pid, E.qrToken(st.sessions[0], st.now));

// ---------- Questionário (fonte 7.3) ----------

test("classify: alarm sign is emergency", () => {
  for (const a of ["falta_ar", "dor_peito", "desmaio", "avc", "sangramento", "convulsao"]) {
    assert.equal(E.classify(answers({ alarms: [a] }), 30).level, "emergencia", a);
  }
  const st = baseState();
  const r = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: answers({ alarms: ["dor_peito"] }) });
  assert.equal(r.ok, false);
  assert.equal(r.error, "emergencia");
  assert.equal(st.entries.length, 0);
});

test("classify: self-harm is urgent with support", () => {
  const c = E.classify(answers({ alarms: ["autolesao"] }), 30);
  assert.equal(c.level, "urgente");
  assert.equal(c.support, true);
  const st = baseState();
  const r = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: answers({ alarms: ["autolesao"] }) });
  assert.equal(r.ok, true);
  assert.equal(r.entry.suggested, "urgente");
  assert.equal(r.entry.confirmedLevel, null);
  assert.ok(st.alerts.some((al) => al.entryId === r.entry.id));
});

test("classify: urgent, attention and routine rules", () => {
  const novo = (g, extra = {}) => answers({ motivo: "novo", gravidade: g, ...extra });
  assert.equal(E.classify(novo("forte"), 30).level, "urgente");
  assert.equal(E.classify(novo("moderado", { grupos: ["gestante"] }), 30).level, "urgente");
  assert.equal(E.classify(novo("moderado"), 30).level, "atencao");
  assert.equal(E.classify(novo("leve", { condicoes: ["diabetes"] }), 30).level, "atencao");
  assert.equal(E.classify(novo("leve"), 1).level, "atencao");
  assert.equal(E.classify(novo("leve"), 60).level, "atencao");
  assert.equal(E.classify(novo("leve"), 59).level, "rotina");
  assert.equal(E.classify(novo("leve", { grupos: ["gestante"] }), 30).level, "atencao");
  assert.equal(E.classify(answers({ motivo: "acompanhamento", condicoes: ["diabetes"] }), 70).level, "rotina");
  assert.equal(E.classify(answers({ motivo: "receita" }), 30).level, "rotina");
});

// ---------- Lista de espera ----------

test("waitlist: one active entry per service", () => {
  const st = baseState();
  const first = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: none });
  assert.equal(first.ok, true);
  const again = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: none });
  assert.equal(again.ok, false);
  assert.equal(again.error, "duplicada");
  assert.equal(again.existing.id, first.entry.id);
  assert.equal(st.entries.length, 1);
  const other = E.createEntry(st, { patientId: "ana", serviceId: "car", answers: none, referralPhoto: "x.jpg" });
  assert.equal(other.ok, true);
});

test("waitlist: referral gates allocation", () => {
  const st = baseState({
    sessions: [{ id: "s2", serviceId: "car", start: NOW + DAY, slots: 3, visibility: "privada" }],
  });
  const r = E.createEntry(st, { patientId: "ana", serviceId: "car", answers: none, referralPhoto: "enc.jpg" });
  assert.equal(r.entry.status, "aguardando_encaminhamento");
  assert.equal(E.suggest(st, "s2").length, 0);
  const blocked = E.allocate(st, "s2", [r.entry.id], { version: st.sessions[0].version });
  assert.equal(blocked.ok, false);
  E.rejectReferral(st, r.entry.id, "Encaminhamento ilegível");
  assert.equal(r.entry.status, "aguardando_encaminhamento");
  assert.ok(st.notifications.some((n) => n.patientId === "ana" && n.text.includes("Encaminhamento ilegível")));
  E.acceptReferral(st, r.entry.id);
  assert.equal(r.entry.status, "aguardando");
  assert.equal(E.suggest(st, "s2").length, 1);
});

// ---------- Alocação ----------

test("allocation: suggestion order and reasons", () => {
  const st = baseState();
  st.sessions[0].slots = 10;
  const mk = (pid, daysAgo, ans) => {
    st.now = NOW - daysAgo * DAY;
    return E.createEntry(st, { patientId: pid, serviceId: "cli", answers: ans }).entry;
  };
  const routineOld = mk("ana", 50, none);
  const routineNew = mk("joao", 10, none);
  const attention = mk("bruno", 5, answers({ motivo: "novo", gravidade: "moderado" }));
  const elderly = mk("dora", 20, none); // 82 anos, rotina, prioridade legal 80+
  const remanejado = mk("edu", 1, none);
  st.now = NOW;
  remanejado.remanejado = true;
  routineNew.confirmedLevel = "urgente"; // urgência confirmada por agendador anterior
  const ids = E.suggest(st, "s1").map((s) => s.entry.id);
  assert.deepEqual(ids, [routineNew.id, remanejado.id, attention.id, elderly.id, routineOld.id]);
  const dora = E.suggest(st, "s1").find((s) => s.entry.id === elderly.id);
  assert.ok(dora.reasons.includes("idosa, 82 anos"), dora.reasons.join(" · "));
  assert.ok(dora.reasons.includes("espera há 20 dias"), dora.reasons.join(" · "));
  st.patients.find((p) => p.id === "ana").faltas = [NOW - 10 * DAY, NOW - 40 * DAY];
  const ana = E.suggest(st, "s1").find((s) => s.entry.id === routineOld.id);
  assert.equal(ana.faltaAlert, true);
});

test("allocation: never exceeds slots", () => {
  const st = baseState();
  const entries = ["ana", "joao", "bruno", "dora"].map(
    (pid) => E.createEntry(st, { patientId: pid, serviceId: "cli", answers: none }).entry,
  );
  const over = E.allocate(
    st,
    "s1",
    entries.map((e) => e.id),
    { version: st.sessions[0].version },
  );
  assert.equal(over.ok, false);
  assert.equal(over.error, "sem_vagas");
  assert.ok(entries.every((e) => e.status === "aguardando"));
  const ok = E.allocate(
    st,
    "s1",
    entries.slice(0, 3).map((e) => e.id),
    { version: st.sessions[0].version },
  );
  assert.equal(ok.ok, true);
  assert.equal(E.occupied(st, "s1"), 3);
  const stale = E.allocate(st, "s1", [entries[3].id], { version: st.sessions[0].version - 1 });
  assert.equal(stale.ok, false);
  assert.equal(stale.error, "conflito");
  assert.ok(st.notifications.some((n) => n.patientId === "ana" && n.text.includes("24 h")));
});

test("allocation: refusal keeps original date", () => {
  const st = baseState();
  st.now = NOW - 30 * DAY;
  const e = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: none }).entry;
  st.now = NOW;
  const original = e.createdAt;
  E.allocate(st, "s1", [e.id], { version: st.sessions[0].version });
  assert.equal(E.occupied(st, "s1"), 1);
  E.refuseAllocation(st, e.id);
  assert.equal(e.status, "aguardando");
  assert.equal(e.sessionId, null);
  assert.equal(e.createdAt, original);
  assert.equal(E.occupied(st, "s1"), 0);
  assert.equal(E.suggest(st, "s1")[0].entry.id, e.id);
});

// ---------- Fila do dia ----------

test("queue: open numbers by original date", () => {
  const st = baseState();
  st.now = NOW - 5 * DAY;
  const older = E.createEntry(st, { patientId: "joao", serviceId: "cli", answers: none }).entry;
  st.now = NOW - 9 * DAY;
  const oldest = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: none }).entry;
  st.now = NOW - 1 * DAY;
  const pending = E.createEntry(st, { patientId: "bruno", serviceId: "cli", answers: none }).entry;
  st.now = NOW;
  E.allocate(st, "s1", [older.id, oldest.id, pending.id], { version: st.sessions[0].version });
  E.confirmAllocation(st, older.id);
  E.confirmAllocation(st, oldest.id);
  E.openSession(st, "s1");
  assert.equal(item(st, "ana").number, 1);
  assert.equal(item(st, "ana").senha, "C-001");
  assert.equal(item(st, "joao").number, 2);
  assert.equal(item(st, "joao").senha, "C-002");
  assert.equal(item(st, "ana").presence, "remoto");
  assert.equal(item(st, "bruno"), undefined);
  assert.equal(pending.status, "aguardando");
  assert.equal(pending.sessionId, null);
});

test("queue: eta and position", () => {
  const st = confirmedSession(["ana", "joao", "bruno", "dora"]);
  // Dora tem 82 anos: prioridade legal, vem antes dos outros de mesmo risco.
  assert.deepEqual(E.eta(st, "s1", item(st, "ana").id), { position: 2, minutes: 15 });
  assert.deepEqual(E.eta(st, "s1", item(st, "bruno").id), { position: 4, minutes: 45 });
  st.stations.push({ id: "st2", name: "Consultório 4", services: ["cli"], open: true, current: null });
  assert.deepEqual(E.eta(st, "s1", item(st, "bruno").id), { position: 4, minutes: 23 });
  for (const s of st.stations) s.open = false;
  assert.deepEqual(E.eta(st, "s1", item(st, "bruno").id), { position: 4, minutes: null });
});

test("queue: qr current and previous only", () => {
  const st = confirmedSession(["ana", "joao"]);
  const s = st.sessions[0];
  const prev = E.qrToken(s, st.now - 30 * 1000);
  const old = E.qrToken(s, st.now - 60 * 1000);
  assert.equal(E.checkIn(st, "s1", "joao", old).ok, false);
  assert.equal(E.checkIn(st, "s1", "joao", old).error, "qr_invalido");
  assert.equal(item(st, "joao").presence, "remoto");
  assert.equal(E.checkIn(st, "s1", "joao", prev).ok, true);
  assert.equal(item(st, "joao").presence, "presente");
  assert.equal(checkIn(st, "ana").ok, true);
  const n = item(st, "ana").number;
  E.leave(st, "s1", "ana");
  assert.equal(item(st, "ana").presence, "remoto");
  assert.equal(item(st, "ana").number, n);
});

test("order: RN-ORD-01 protected window", () => {
  const st = confirmedSession(["ana", "joao"]); // Ana tem posição melhor
  checkIn(st, "joao");
  assert.deepEqual(order(st), ["joao"]);
  checkIn(st, "ana");
  assert.deepEqual(order(st), ["joao", "ana"]);
  assert.equal(E.callNext(st, "s1", "st1").item.patientId, "joao");
  assert.equal(E.callNext(st, "s1", "st1").item.patientId, "ana");
});

test("order: RN-ORD-03 consecutive check-ins", () => {
  const st = confirmedSession(["bruno", "ana", "joao"]);
  checkIn(st, "joao");
  checkIn(st, "ana");
  assert.deepEqual(order(st), ["joao", "ana"]);
  checkIn(st, "bruno");
  assert.deepEqual(order(st), ["joao", "bruno", "ana"]);
});

test("order: RN-ORD-04 late arrival", () => {
  const st = confirmedSession(["bruno", "ana", "joao"]);
  checkIn(st, "ana");
  checkIn(st, "joao");
  assert.equal(E.callNext(st, "s1", "st1").item.patientId, "ana");
  checkIn(st, "bruno");
  assert.equal(item(st, "bruno").number, 4);
  assert.deepEqual(order(st), ["joao", "bruno"]);
});

test("order: confirmed urgency jumps window", () => {
  const st = confirmedSession(["ana", "joao", "bruno"]);
  checkIn(st, "ana");
  checkIn(st, "joao");
  E.confirmRisk(st, "s1", item(st, "bruno").id, "urgente");
  assert.ok(st.notifications.some((n) => n.patientId === "bruno" && n.text.includes("Venha agora")));
  checkIn(st, "bruno");
  assert.deepEqual(order(st), ["bruno", "ana", "joao"]);
  assert.equal(E.callNext(st, "s1", "st1").item.patientId, "bruno");
  // Atraso também não vale para urgência confirmada.
  const st2 = confirmedSession(["bruno", "ana"]);
  checkIn(st2, "ana");
  E.callNext(st2, "s1", "st1");
  E.confirmRisk(st2, "s1", item(st2, "bruno").id, "urgente");
  checkIn(st2, "bruno");
  assert.equal(item(st2, "bruno").number, 1);
});

test("call: next closes previous and skips remote", () => {
  const st = confirmedSession(["ana", "joao", "bruno"]);
  checkIn(st, "joao");
  checkIn(st, "bruno");
  const first = E.callNext(st, "s1", "st1");
  assert.equal(first.item.patientId, "joao"); // Ana (nº 1) está remota
  assert.equal(item(st, "joao").status, "chamado");
  assert.ok(st.tv.announcements.some((a) => a.senha === item(st, "joao").senha && a.dest === "Consultório 3"));
  assert.ok(st.notifications.some((n) => n.patientId === "joao" && n.text.includes("Sua vez")));
  E.callNext(st, "s1", "st1");
  assert.equal(item(st, "joao").status, "atendido");
  assert.equal(item(st, "bruno").status, "chamado");
  const empty = E.callNext(st, "s1", "st1");
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "ninguem");
  assert.equal(item(st, "bruno").status, "atendido");
  assert.equal(item(st, "ana").status, "fila");
});

test("call: three skips", () => {
  const st = confirmedSession(["ana", "joao", "bruno"]);
  checkIn(st, "ana");
  checkIn(st, "joao");
  checkIn(st, "bruno");
  E.callNext(st, "s1", "st1"); // Ana
  st.now += 5 * MIN;
  E.tick(st); // tolerância esgota: 1º pulo
  assert.equal(item(st, "ana").skips, 1);
  assert.equal(item(st, "ana").presence, "presente");
  assert.deepEqual(order(st), ["joao", "ana", "bruno"]);
  E.callNext(st, "s1", "st1"); // João
  E.callNext(st, "s1", "st1"); // Ana de novo
  assert.equal(item(st, "ana").status, "chamado");
  E.skip(st, "s1", "st1"); // 2º pulo
  assert.equal(item(st, "ana").presence, "remoto");
  assert.equal(item(st, "ana").status, "fila");
  checkIn(st, "ana");
  E.callNext(st, "s1", "st1"); // Bruno
  E.callNext(st, "s1", "st1"); // Ana
  E.skip(st, "s1", "st1"); // 3º pulo
  assert.equal(item(st, "ana").status, "saiu");
  assert.equal(st.entries.find((e) => e.patientId === "ana").status, "encerrada");
  assert.equal(st.patients.find((p) => p.id === "ana").faltas.length, 1);
});

test("queue: leave home notice once", () => {
  const st = confirmedSession(["ana", "joao", "bruno", "dora"]);
  st.config.leaveHomeMin = 30;
  // Dora (prioridade legal) é a 1ª; Bruno é o 4º: 3 à frente × 15 min = 45 min.
  const leaveHome = (pid) => st.notifications.filter((n) => n.patientId === pid && n.text.includes("Saia de casa"));
  E.tick(st);
  assert.equal(leaveHome("bruno").length, 0);
  assert.equal(leaveHome("joao").length, 1); // 2 à frente = 30 min
  checkIn(st, "dora");
  E.callNext(st, "s1", "st1");
  E.tick(st);
  assert.equal(leaveHome("bruno").length, 1);
  E.tick(st);
  assert.equal(leaveHome("bruno").length, 1);
});

test("queue: front desk entry is present", () => {
  const st = confirmedSession(["ana", "joao"], { slots: 3 });
  const r = E.frontDesk(st, "s1", { name: "Seu Zé", birth: "1960-05-05", answers: none });
  assert.equal(r.ok, true);
  assert.equal(r.item.presence, "presente");
  assert.equal(r.item.number, 3);
  assert.equal(r.item.senha, "C-003");
  const full = E.frontDesk(st, "s1", { name: "Outra", birth: "1990-01-01", answers: none });
  assert.equal(full.ok, false);
  assert.equal(full.error, "sem_vagas");
  st.sessions[0].slots = 5;
  const emerg = E.frontDesk(st, "s1", { name: "X", birth: "1990-01-01", answers: answers({ alarms: ["convulsao"] }) });
  assert.equal(emerg.ok, false);
  assert.equal(emerg.error, "emergencia");
});
