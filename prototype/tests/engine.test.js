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
  assert.equal(E.classify(answers({ alarms: ["nenhum"] }), 30).level, "rotina");
  assert.equal(E.classify(answers({ alarms: ["autolesao", "dor_peito"] }), 30).level, "emergencia");
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
  assert.equal(E.classify(novo("leve", { condicoes: ["nenhuma"] }), 30).level, "rotina");
  assert.equal(E.classify(novo("leve"), 1).level, "atencao");
  assert.equal(E.classify(novo("leve"), 2).level, "rotina");
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
  assert.equal(blocked.error, "nao_alocavel");
  E.rejectReferral(st, r.entry.id, "Encaminhamento ilegível");
  assert.equal(r.entry.status, "aguardando_encaminhamento");
  assert.ok(st.notifications.some((n) => n.patientId === "ana" && n.text.includes("Encaminhamento ilegível")));
  E.acceptReferral(st, r.entry.id);
  assert.equal(r.entry.status, "aguardando");
  assert.ok(st.notifications.some((n) => n.patientId === "ana" && n.text.includes("Encaminhamento aceito")));
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
  const anaFalta = () => E.suggest(st, "s1").find((s) => s.entry.id === routineOld.id).faltaAlert;
  const ana = st.patients.find((p) => p.id === "ana");
  ana.faltas = [NOW - 10 * DAY];
  assert.equal(anaFalta(), false);
  ana.faltas = [NOW - 10 * DAY, NOW - 91 * DAY];
  assert.equal(anaFalta(), false);
  ana.faltas = [NOW - 10 * DAY, NOW - 89 * DAY];
  assert.equal(anaFalta(), true);
  // 80+ vem antes de 60-79 com o mesmo risco, mesmo esperando há menos tempo.
  st.patients.push({ id: "seu", name: "Seu Zé", sexo: "M", birth: "1956-01-01", faltas: [] }); // 70 anos
  st.now = NOW - 90 * DAY;
  const seventy = E.createEntry(st, { patientId: "seu", serviceId: "cli", answers: none }).entry;
  st.now = NOW;
  const order60 = E.suggest(st, "s1").map((s) => s.entry.id);
  assert.ok(order60.indexOf(elderly.id) < order60.indexOf(seventy.id));
  assert.ok(order60.indexOf(seventy.id) < order60.indexOf(routineOld.id));
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
  // Dois agendadores leem a mesma versão; o segundo a gravar recebe conflito.
  const st2 = baseState();
  st2.sessions[0].slots = 5;
  const [x, y] = ["ana", "joao"].map(
    (pid) => E.createEntry(st2, { patientId: pid, serviceId: "cli", answers: none }).entry,
  );
  const seen = st2.sessions[0].version;
  assert.equal(E.allocate(st2, "s1", [x.id], { version: seen }).ok, true);
  const stale = E.allocate(st2, "s1", [y.id], { version: seen });
  assert.equal(stale.ok, false);
  assert.equal(stale.error, "conflito");
  assert.equal(y.status, "aguardando");
  assert.equal(E.allocate(st2, "s1", [y.id], { version: st2.sessions[0].version }).ok, true);
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
  // O refused volta à lista, mas não é sugerido de novo para a mesma sessão.
  st.sessions.push({
    id: "s9",
    serviceId: "cli",
    start: NOW + 9 * DAY,
    slots: 3,
    visibility: "privada",
    state: "planejada",
    version: 1,
    queue: [],
    nextNumber: 1,
    maxCalledNumber: 0,
    secret: "s9",
  });
  assert.equal(E.suggest(st, "s9")[0].entry.id, e.id);
  assert.equal(E.suggest(st, "s1").length, 0);
  const other = E.createEntry(st, {
    patientId: "joao",
    serviceId: "cli",
    answers: answers({ motivo: "novo", gravidade: "forte" }),
  }).entry;
  E.allocate(st, "s1", [other.id], { version: st.sessions[0].version });
  const r = E.refuseAllocation(st, other.id);
  assert.equal(r.next, null); // ninguém além dos dois que recusaram
  const third = E.createEntry(st, { patientId: "bruno", serviceId: "cli", answers: none }).entry;
  assert.deepEqual(
    E.suggest(st, "s1").map((s) => s.entry.id),
    [third.id],
  );
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
  assert.equal(E.etaText({ position: 4, minutes: 12 }), "você é o 4º · ~12 min");
  assert.equal(E.etaText({ position: 1, minutes: 0 }), "você é o 1º · ~0 min");
  assert.equal(E.etaText({ position: 4, minutes: null }), "você é o 4º · aguardando início do atendimento");
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
  E.confirmRisk(st, "s1", item(st, "ana").id, "urgente"); // presente: não recebe "venha agora"
  assert.ok(!st.notifications.some((n) => n.patientId === "ana" && n.text.includes("Venha agora")));
  E.confirmRisk(st, "s1", item(st, "ana").id, "rotina");
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
  // Atendidos deixam de ocupar vaga, venham da lista ou do balcão (INV-02: entradas não finais).
  assert.equal(E.callNext(st, "s1", "st1").item.senha, "C-003");
  E.finish(st, "s1", "st1");
  assert.equal(E.occupied(st, "s1"), 2);
  st.sessions[0].slots = 5;
  const emerg = E.frontDesk(st, "s1", { name: "X", birth: "1990-01-01", answers: answers({ alarms: ["convulsao"] }) });
  assert.equal(emerg.ok, false);
  assert.equal(emerg.error, "emergencia");
});

// ---------- Visões que as telas mostram ----------

test("quiz: none option is exclusive", () => {
  assert.deepEqual(E.toggleOption(["diabetes", "asma"], "nenhuma", "nenhuma"), ["nenhuma"]);
  assert.deepEqual(E.toggleOption(["nenhuma"], "diabetes", "nenhuma"), ["diabetes"]);
  assert.deepEqual(E.toggleOption(["diabetes"], "asma", "nenhuma"), ["diabetes", "asma"]);
  assert.deepEqual(E.toggleOption(["diabetes", "asma"], "diabetes", "nenhuma"), ["asma"]);
});

test("agenda: unit shows future sessions with remaining slots", () => {
  const st = baseState({
    units: [{ id: "u1", name: "UBS Vila Nova", hours: "Seg a Sex · 7h às 17h" }],
    sessions: [
      { id: "s1", serviceId: "cli", start: Date.UTC(2026, 10, 17, 10, 0), slots: 20, visibility: "privada" },
      { id: "s0", serviceId: "cli", start: NOW - DAY, slots: 5, visibility: "pública" },
    ],
  });
  const e = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: none }).entry;
  E.allocate(st, "s1", [e.id], { version: st.sessions[0].version });
  const agenda = E.unitAgenda(st, "u1");
  assert.equal(agenda.hours, "Seg a Sex · 7h às 17h");
  assert.deepEqual(
    agenda.sessions.map((s) => s.text),
    ["Terça, 17/11 · Clínico geral · privada · 19 vagas"],
  );
  assert.ok(!JSON.stringify(agenda).includes("Ana"));
});

test("tv: pairing shows only code until paired and after revoke", () => {
  const st = confirmedSession(["ana", "joao"]);
  const before = E.tvView(st);
  assert.equal(before.paired, false);
  assert.match(before.code, /^\d{6}$/);
  assert.equal(before.counters, undefined);
  assert.equal(before.qr, undefined);
  assert.equal(E.pairTv(st, "000000").ok, false);
  assert.equal(E.pairTv(st, before.code).ok, true);
  const after = E.tvView(st);
  assert.equal(after.paired, true);
  assert.deepEqual(after.counters, [{ name: "Clínico geral", aguardando: 0, caminho: 2 }]);
  assert.equal(after.qr, E.qrToken(st.sessions[0], st.now));
  E.revokeTv(st);
  const revoked = E.tvView(st);
  assert.equal(revoked.paired, false);
  assert.match(revoked.code, /^\d{6}$/);
});

test("tv: shows only tickets and counters, never names", () => {
  const st = confirmedSession(["ana", "joao", "bruno"]);
  E.pairTv(st, E.tvView(st).code);
  checkIn(st, "ana");
  checkIn(st, "joao");
  E.callNext(st, "s1", "st1");
  const view = E.tvView(st);
  assert.deepEqual(view.counters, [{ name: "Clínico geral", aguardando: 1, caminho: 1 }]);
  assert.deepEqual(
    view.announcements.map((a) => [a.senha, a.dest, a.service]),
    [["C-001", "Consultório 3", "Clínico geral"]],
  );
  const json = JSON.stringify(view);
  for (const p of st.patients) assert.ok(!json.includes(p.name), p.name);
});

test("privacy: patient view holds only own data", () => {
  const st = confirmedSession(["ana", "joao", "bruno"]);
  checkIn(st, "joao");
  E.callNext(st, "s1", "st1");
  const v = E.patientView(st, "ana");
  assert.ok(v.entries.every((e) => e.patientId === "ana"));
  assert.ok(v.notifications.every((n) => n.patientId === "ana"));
  assert.equal(v.queue.senha, "C-001");
  assert.deepEqual(v.queue.eta, E.eta(st, "s1", item(st, "ana").id));
  const json = JSON.stringify(v);
  for (const name of ["João", "Bruno", "C-002", "C-003"]) assert.ok(!json.includes(name), name);
});

test("calllist: pending allocation highlighted after 24 h", () => {
  const st = baseState();
  const e = E.createEntry(st, { patientId: "ana", serviceId: "cli", answers: none }).entry;
  E.allocate(st, "s1", [e.id], { version: st.sessions[0].version });
  assert.equal(e.status, "alocada");
  assert.ok(st.notifications.some((n) => n.patientId === "ana" && n.text.includes("Confirme em 24 h")));
  assert.deepEqual(
    E.callList(st).map((c) => [c.entry.id, c.overdue]),
    [[e.id, false]],
  );
  E.advance(st, 24 * 60 * MIN - MIN);
  assert.equal(E.callList(st)[0].overdue, false);
  E.advance(st, MIN);
  assert.equal(E.callList(st)[0].overdue, true);
  assert.equal(E.confirmAllocation(st, e.id).ok, true);
  assert.equal(e.status, "confirmada");
  assert.equal(E.callList(st).length, 0);
});

test("clock: advancing re-evaluates tolerance", () => {
  const st = confirmedSession(["ana", "joao"]);
  checkIn(st, "ana");
  E.callNext(st, "s1", "st1");
  E.advance(st, 4 * MIN);
  assert.equal(item(st, "ana").status, "chamado");
  E.advance(st, MIN);
  assert.equal(item(st, "ana").status, "fila");
  assert.equal(item(st, "ana").skips, 1);
});

// ---------- Revisão 2: posição real e regra de prioridade (AD-002 a AD-004) ----------

test("eta: present patient sees real call order", () => {
  const st = confirmedSession(["ana", "joao", "bruno", "dora"]); // Dora, 82, tem prioridade legal
  checkIn(st, "joao");
  checkIn(st, "ana"); // posição melhor, mas fica atrás de João (janela protegida)
  const joao = E.patientEta(st, "s1", item(st, "joao").id);
  assert.deepEqual(joao, { mode: "presente", position: 1, minutes: 0, comeNow: false });
  assert.equal(E.etaText(joao), "você é o 1º a ser chamado · ~0 min");
  const ana = E.patientEta(st, "s1", item(st, "ana").id);
  assert.deepEqual(ana, { mode: "presente", position: 2, minutes: 15, comeNow: false });
  assert.equal(E.etaText(ana), "você é o 2º a ser chamado · ~15 min");
  st.stations[0].open = true;
  st.stations.push({ id: "st2", name: "Consultório 4", services: ["cli"], open: true, current: null });
  assert.equal(E.patientEta(st, "s1", item(st, "ana").id).minutes, 8);
  // Remoto continua com RN-ETA-01 (todos à frente, presentes e remotos).
  assert.deepEqual(E.patientEta(st, "s1", item(st, "bruno").id), {
    mode: "remoto",
    position: 4,
    minutes: 23,
    comeNow: false,
  });
});

test("eta: remote first sees come now", () => {
  const st = confirmedSession(["ana", "joao", "dora"]);
  const dora = () => E.patientEta(st, "s1", item(st, "dora").id);
  assert.deepEqual(dora(), { mode: "remoto", position: 1, minutes: 0, comeNow: true });
  assert.match(E.etaText(dora()), /venha agora/);
  assert.doesNotMatch(E.etaText(dora()), /1º/);
  assert.equal(E.patientEta(st, "s1", item(st, "ana").id).comeNow, false);
  st.stations[0].open = false;
  assert.deepEqual(dora(), { mode: "remoto", position: 1, minutes: null, comeNow: false });
  assert.equal(E.etaText(dora()), "você é o 1º · aguardando início do atendimento");
  // Presente nunca vê "venha agora".
  st.stations[0].open = true;
  checkIn(st, "dora");
  assert.equal(dora().comeNow, false);
});

test("priority: municipal rule switches legal before risk", () => {
  const st = baseState();
  st.sessions[0].slots = 10;
  const mk = (pid, daysAgo, ans) => {
    st.now = NOW - daysAgo * DAY;
    return E.createEntry(st, { patientId: pid, serviceId: "cli", answers: ans }).entry;
  };
  const urgent = mk("joao", 1, none);
  const reman = mk("edu", 2, none);
  const attention = mk("bruno", 5, answers({ motivo: "novo", gravidade: "moderado" }));
  const elderly = mk("dora", 3, none);
  const routine = mk("ana", 50, none);
  st.now = NOW;
  urgent.confirmedLevel = "urgente";
  reman.remanejado = true;
  const ids = () => E.suggest(st, "s1").map((s) => s.entry.id);
  assert.equal(st.config.priorityOrder, "risco");
  assert.deepEqual(ids(), [urgent.id, reman.id, attention.id, elderly.id, routine.id]);
  st.config.priorityOrder = "legal";
  assert.deepEqual(ids(), [urgent.id, reman.id, elderly.id, attention.id, routine.id]);
  // Na fila do dia, a mesma regra vale para a ordem.
  const q = confirmedSession(["bruno", "dora"]);
  item(q, "bruno").confirmedLevel = "atencao";
  const pos = (pid) => E.eta(q, "s1", item(q, pid).id).position;
  assert.equal(pos("bruno"), 1);
  q.config.priorityOrder = "legal";
  assert.equal(pos("dora"), 1);
  assert.equal(pos("bruno"), 2);
  E.confirmRisk(q, "s1", item(q, "bruno").id, "urgente");
  assert.equal(pos("bruno"), 1);
});
