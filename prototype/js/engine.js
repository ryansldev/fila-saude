// Regras do protótipo: questionário, lista de espera, alocação e fila do dia.
// Funções puras sobre um objeto de estado em memória. Sem DOM: roda no navegador e no Node.
// Códigos RN-*, INV-* remetem a .specs/features/mvp-filas/source.md.
((root) => {
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;
  const QR_STEP = 30 * 1000;
  const RISK_RANK = { urgente: 3, atencao: 2, rotina: 1 };
  const RISK_LABEL = { urgente: "Urgente", atencao: "Atenção", rotina: "Rotina", emergencia: "Emergência" };
  const FINAL_ENTRY = ["concluida", "cancelada", "encerrada"];
  const GROUP_LABEL = {
    gestante: "gestante",
    lactante: "lactante",
    colo: "com criança de colo",
    pcd: "PcD",
    tea: "TEA",
    obesidade: "obesidade",
  };

  function createState(partial) {
    const st = {
      now: Date.now(),
      config: { K: 1, toleranceMin: 5, leaveHomeMin: 30, avgMin: 15, confirmHours: 24, priorityOrder: "risco" },
      units: [],
      services: [],
      sessions: [],
      patients: [],
      entries: [],
      notifications: [],
      alerts: [],
      stations: [],
      tv: { paired: false, code: "482913", announcements: [] },
      log: [],
      seq: 0,
      ...partial,
    };
    st.config = {
      K: 1,
      toleranceMin: 5,
      leaveHomeMin: 30,
      avgMin: 15,
      confirmHours: 24,
      priorityOrder: "risco",
      ...partial?.config,
    };
    st.patients.forEach((p) => {
      p.faltas = p.faltas || [];
    });
    st.stations.forEach((s) => {
      s.current = s.current || null;
      s.stage = s.stage || "atendimento";
    });
    st.sessions.forEach((s) => {
      s.state = s.state || "planejada";
      s.version = s.version || 1;
      s.queue = s.queue || [];
      s.nextNumber = s.nextNumber || 1;
      s.maxCalled = s.maxCalled || {}; // maior número já chamado, por etapa
      s.secret = s.secret || `q${s.id}`;
    });
    return st;
  }

  const nextId = (st, p) => `${p}${++st.seq}`;
  const byId = (list, id) => list.find((x) => x.id === id);
  const service = (st, id) => byId(st.services, id);
  const session = (st, id) => byId(st.sessions, id);
  const patient = (st, id) => byId(st.patients, id);

  function ageAt(birth, now) {
    const b = new Date(birth);
    const n = new Date(now);
    let a = n.getUTCFullYear() - b.getUTCFullYear();
    const m = n.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && n.getUTCDate() < b.getUTCDate())) a--;
    return a;
  }

  function notify(st, patientId, text) {
    if (patientId) st.notifications.push({ id: nextId(st, "n"), patientId, text, at: st.now });
  }

  // ---------- Questionário v1 (fonte 7.3): vale a primeira regra que bater ----------

  function classify(a, age) {
    const alarms = (a.alarms || []).filter((x) => x !== "nenhum");
    const grupos = a.grupos || [];
    const condicoes = (a.condicoes || []).filter((x) => x !== "nenhuma");
    const novo = a.motivo === "novo";
    const gestante = grupos.includes("gestante");
    if (alarms.some((x) => x !== "autolesao")) return { level: "emergencia", rule: "Sinal de alarme na Tela 1" };
    if (alarms.includes("autolesao"))
      return { level: "urgente", support: true, rule: "Pensamentos de tirar a própria vida ou de se machucar" };
    if (novo && a.gravidade === "forte") return { level: "urgente", rule: "Problema novo forte" };
    if (novo && a.gravidade === "moderado" && gestante)
      return { level: "urgente", rule: "Gestante com problema novo moderado" };
    if (novo && a.gravidade === "moderado") return { level: "atencao", rule: "Problema novo moderado" };
    if (novo && condicoes.length) return { level: "atencao", rule: "Problema novo com condição de saúde" };
    if (novo && (age < 2 || age >= 60))
      return { level: "atencao", rule: "Problema novo com idade abaixo de 2 ou a partir de 60" };
    if (novo && a.gravidade === "leve" && gestante)
      return { level: "atencao", rule: "Gestante com problema novo leve" };
    return { level: "rotina", rule: "Sem sinais de risco" };
  }

  // Prioridade legal (RN-RISCO-04): 80+ antes dos demais; entre grupos diferentes, empate.
  function legalPriority(age, grupos, sexo) {
    const idoso = sexo === "F" ? "idosa" : "idoso";
    if (age >= 80) return { rank: 2, label: `${idoso}, ${age} anos` };
    if (age >= 60) return { rank: 1, label: `${idoso}, ${age} anos` };
    const g = (grupos || []).filter((x) => GROUP_LABEL[x]);
    if (g.length) return { rank: 1, label: g.map((x) => GROUP_LABEL[x]).join(", ") };
    return { rank: 0, label: null };
  }

  const vigente = (x) => x.confirmedLevel || x.suggested;
  const urgConf = (x) => x.confirmedLevel === "urgente";

  // ---------- Lista de espera ----------

  // RN-LE-02 / INV-01: no máximo uma entrada ativa por serviço.
  function activeEntry(st, patientId, serviceId) {
    return st.entries.find(
      (e) => e.patientId === patientId && e.serviceId === serviceId && !FINAL_ENTRY.includes(e.status),
    );
  }

  function createEntry(st, { patientId, serviceId, answers, referralPhoto }) {
    const p = patient(st, patientId);
    const svc = service(st, serviceId);
    const age = ageAt(p.birth, st.now);
    const c = classify(answers, age);
    if (c.level === "emergencia") return { ok: false, error: "emergencia", classification: c };
    const existing = activeEntry(st, patientId, serviceId);
    if (existing) return { ok: false, error: "duplicada", existing, classification: c };
    const legal = legalPriority(age, answers.grupos, p.sexo);
    const entry = {
      id: nextId(st, "e"),
      patientId,
      serviceId,
      createdAt: st.now,
      suggested: c.level,
      rule: c.rule,
      support: !!c.support,
      confirmedLevel: null,
      answers,
      legal,
      remanejado: false,
      refusals: 0,
      refusedSessions: [],
      sessionId: null,
      status: svc.requiresReferral ? "aguardando_encaminhamento" : "aguardando",
      referral: svc.requiresReferral ? { status: "pendente", photo: referralPhoto || null, reason: null } : null,
    };
    st.entries.push(entry);
    if (c.level === "urgente")
      st.alerts.push({
        id: nextId(st, "a"),
        entryId: entry.id,
        text: `${p.name}: urgente sugerido (${c.rule})`,
        at: st.now,
      });
    return { ok: true, entry, classification: c };
  }

  function acceptReferral(st, entryId) {
    const e = byId(st.entries, entryId);
    e.referral.status = "aceito";
    e.status = "aguardando";
    notify(
      st,
      e.patientId,
      `Encaminhamento aceito para ${service(st, e.serviceId).name}. Você está na lista de espera.`,
    );
  }

  function rejectReferral(st, entryId, reason) {
    const e = byId(st.entries, entryId);
    e.referral.status = "rejeitado";
    e.referral.reason = reason;
    notify(st, e.patientId, `Encaminhamento rejeitado: ${reason}. Envie outra foto.`);
  }

  // AD-004: o município escolhe se o risco vem antes da prioridade legal ("risco") ou o contrário ("legal").
  function riskThenLegal(st, a, b) {
    const risk = RISK_RANK[vigente(b)] - RISK_RANK[vigente(a)];
    const legal = b.legal.rank - a.legal.rank;
    return st.config.priorityOrder === "legal" ? legal || risk : risk || legal;
  }

  // ---------- Alocação (RN-AL) ----------

  function allocCompare(st, a, b) {
    return (
      urgConf(b) - urgConf(a) || b.remanejado - a.remanejado || riskThenLegal(st, a, b) || a.createdAt - b.createdAt
    );
  }

  function faltasRecentes(st, p) {
    return p.faltas.filter((t) => st.now - t <= 90 * DAY).length;
  }

  function reasons(st, e) {
    const r = [];
    r.push(
      e.confirmedLevel
        ? `${RISK_LABEL[e.confirmedLevel].toLowerCase()} confirmado`
        : `${RISK_LABEL[e.suggested].toLowerCase()} sugerido`,
    );
    if (e.remanejado) r.push("remanejado");
    if (e.legal.label) r.push(e.legal.label);
    r.push(`espera há ${Math.floor((st.now - e.createdAt) / DAY)} dias`);
    return r;
  }

  function suggest(st, sessionId) {
    const s = session(st, sessionId);
    return st.entries
      .filter((e) => e.serviceId === s.serviceId && e.status === "aguardando" && !e.refusedSessions.includes(sessionId))
      .sort((a, b) => allocCompare(st, a, b))
      .map((e) => ({
        entry: e,
        reasons: reasons(st, e),
        faltaAlert: faltasRecentes(st, patient(st, e.patientId)) >= 2,
      }));
  }

  // INV-02: entradas não finais numa sessão, somando todos os caminhos.
  function occupied(st, sessionId) {
    const fromList = st.entries.filter(
      (e) => e.sessionId === sessionId && ["alocada", "confirmada", "na_fila"].includes(e.status),
    ).length;
    const desk = session(st, sessionId).queue.filter(
      (q) => q.origin === "balcao" && !["saiu", "atendido"].includes(q.status),
    ).length;
    return fromList + desk;
  }

  function allocate(st, sessionId, entryIds, { version }) {
    const s = session(st, sessionId);
    if (version !== s.version) return { ok: false, error: "conflito" };
    const entries = entryIds.map((id) => byId(st.entries, id));
    if (entries.some((e) => e.status !== "aguardando" || e.serviceId !== s.serviceId))
      return { ok: false, error: "nao_alocavel" };
    if (occupied(st, sessionId) + entries.length > s.slots) return { ok: false, error: "sem_vagas" };
    const deadline = Math.min(st.now + st.config.confirmHours * 60 * MIN, s.start);
    for (const e of entries) {
      e.status = "alocada";
      e.sessionId = sessionId;
      e.allocatedAt = st.now;
      e.deadline = deadline;
      if (!e.confirmedLevel) e.confirmedLevel = e.suggested; // RN-RISCO-01: confirmado na alocação
      notify(st, e.patientId, `Você foi alocado em ${service(st, s.serviceId).name}. Confirme em 24 h.`);
    }
    s.version++;
    return { ok: true };
  }

  function callList(st) {
    return st.entries
      .filter((e) => e.status === "alocada")
      .map((e) => ({ entry: e, overdue: st.now - e.allocatedAt >= st.config.confirmHours * 60 * MIN }))
      .sort((a, b) => session(st, a.entry.sessionId).start - session(st, b.entry.sessionId).start);
  }

  function confirmAllocation(st, entryId) {
    const e = byId(st.entries, entryId);
    if (e.status !== "alocada") return { ok: false, error: "estado" };
    e.status = "confirmada";
    return { ok: true };
  }

  function release(st, e) {
    const s = session(st, e.sessionId);
    e.status = "aguardando";
    e.sessionId = null;
    if (s) s.version++;
  }

  // RN-CONF-04 e RN-REM-03: recusa libera a vaga; data original preservada (INV-09).
  function refuseAllocation(st, entryId) {
    const e = byId(st.entries, entryId);
    if (e.status !== "alocada") return { ok: false, error: "estado" };
    const sessionId = e.sessionId;
    e.refusedSessions.push(sessionId); // quem recusou não volta a ser sugerido para a mesma sessão
    if (e.remanejado && e.refusals === 0) e.refusals++;
    else e.remanejado = false;
    release(st, e);
    return { ok: true, next: suggest(st, sessionId)[0] || null };
  }

  // ---------- Fila do dia ----------

  function qrToken(s, now) {
    const bucket = Math.floor(now / QR_STEP);
    let h = 0;
    const str = `${s.secret}:${bucket}`;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return `${bucket}.${h.toString(36)}`;
  }

  function newItem(st, s, fields) {
    const svc = service(st, s.serviceId);
    const number = s.nextNumber++;
    const it = {
      id: nextId(st, "q"),
      number,
      senha: `${svc.prefix}-${String(number).padStart(3, "0")}`,
      serviceId: s.serviceId,
      presence: "remoto",
      status: "fila",
      skips: 0,
      blockers: [],
      calledAt: null,
      stationId: null,
      leaveHomeSent: false,
      stage: svc.requiresTriage ? "triagem" : "atendimento", // RN-TRI-01
      ...fields,
    };
    s.queue.push(it);
    return it;
  }

  // RN-FILA-01: confirmados entram remotos, numerados pela data de entrada original.
  function openSession(st, sessionId) {
    const s = session(st, sessionId);
    s.state = "aberta";
    st.entries
      .filter((e) => e.sessionId === sessionId && e.status === "alocada")
      .forEach((e) => {
        release(st, e);
      });
    st.entries
      .filter((e) => e.sessionId === sessionId && e.status === "confirmada")
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((e) => {
        e.status = "na_fila";
        const it = newItem(st, s, {
          entryId: e.id,
          patientId: e.patientId,
          name: patient(st, e.patientId).name,
          suggested: e.suggested,
          confirmedLevel: e.confirmedLevel,
          legal: e.legal,
          origin: "alocado",
        });
        notify(st, e.patientId, `Sessão aberta: você está na fila remota com a senha ${it.senha}.`);
      });
    tick(st);
  }

  // RN-ORD, sem travas: usado para posição e tempo (RN-ETA-01).
  function orderCompare(st, a, b) {
    return urgConf(b) - urgConf(a) || riskThenLegal(st, a, b) || a.number - b.number;
  }

  const isEligible = (q) => q.status === "fila" && q.presence === "presente";

  // Sem estação, vale a etapa pedida (padrão: atendimento).
  function stationServes(st, stationId, q, stage) {
    if (!stationId) return q.stage === (stage || "atendimento");
    const station = byId(st.stations, stationId);
    return station.services.includes(q.serviceId) && (station.stage || "atendimento") === q.stage;
  }

  // Ordem de chamada com a janela protegida: ninguém passa à frente de quem o trava (8.3).
  function callOrder(st, sessionId, stationId, exclude, stage) {
    const s = session(st, sessionId);
    const pool = s.queue
      .filter((q) => isEligible(q) && q.id !== exclude && stationServes(st, stationId, q, stage))
      .sort((a, b) => orderCompare(st, a, b));
    const ids = new Set(pool.map((q) => q.id));
    const placed = [];
    const done = new Set();
    while (placed.length < pool.length) {
      // Sem candidato livre (não deveria ocorrer), segue a ordem sem travas em vez de travar a fila.
      const next =
        pool.find((q) => !done.has(q.id) && q.blockers.every((b) => !ids.has(b) || done.has(b))) ||
        pool.find((q) => !done.has(q.id));
      placed.push(next);
      done.add(next.id);
    }
    return placed;
  }

  function becomeEligible(st, s, q, { applyLate }) {
    if (applyLate && !urgConf(q) && (s.maxCalled[q.stage] || 0) > q.number) {
      q.number = s.nextNumber++; // atraso: perdeu a vez, vai para o fim
    }
    q.blockers = urgConf(q)
      ? []
      : callOrder(st, s.id, null, q.id, q.stage)
          .slice(0, st.config.K)
          .map((x) => x.id);
    q.presence = "presente";
  }

  function findItem(s, patientId) {
    return s.queue.find((q) => q.patientId === patientId && q.status !== "saiu" && q.status !== "atendido");
  }

  function checkIn(st, sessionId, patientId, token) {
    const s = session(st, sessionId);
    const valid = [qrToken(s, st.now), qrToken(s, st.now - QR_STEP)];
    if (!valid.includes(token)) return { ok: false, error: "qr_invalido" };
    return markPresent(st, sessionId, patientId);
  }

  // RN-PRES-03: recepção marca presença como se fosse o check-in.
  function markPresent(st, sessionId, patientId) {
    const s = session(st, sessionId);
    const q = findItem(s, patientId);
    if (q?.status !== "fila") return { ok: false, error: "fora_da_fila" };
    if (q.presence === "presente") return { ok: true, item: q };
    becomeEligible(st, s, q, { applyLate: true });
    tick(st);
    return { ok: true, item: q };
  }

  // Quem deixa de estar na sala (chamado, saiu, foi para casa) não trava mais ninguém.
  function releaseLocks(s, q) {
    q.blockers = [];
    for (const x of s.queue) x.blockers = x.blockers.filter((b) => b !== q.id);
  }

  function leave(st, sessionId, patientId) {
    const s = session(st, sessionId);
    const q = findItem(s, patientId);
    if (q?.status !== "fila") return { ok: false, error: "estado" };
    q.presence = "remoto";
    releaseLocks(s, q);
    return { ok: true };
  }

  function openStations(st, serviceId, stage = "atendimento") {
    return st.stations.filter((x) => x.open && (x.stage || "atendimento") === stage && x.services.includes(serviceId))
      .length;
  }

  const avgFor = (st, serviceId, stage) =>
    stage === "triagem" ? service(st, serviceId).avgTriageMin || st.config.avgMin : st.config.avgMin;

  // RN-ETA-01: pessoas à frente em ordem(todas) da mesma etapa, presentes e remotas.
  // Quem ainda não foi triado soma as duas etapas.
  function eta(st, sessionId, itemId) {
    const s = session(st, sessionId);
    const q = byId(s.queue, itemId);
    const sorted = (stage) =>
      s.queue
        .filter((x) => x.status === "fila" && x.serviceId === q.serviceId && (!stage || x.stage === stage))
        .sort((a, b) => orderCompare(st, a, b));
    const ahead = sorted(q.stage).indexOf(q);
    const nA = openStations(st, q.serviceId, "atendimento");
    if (q.stage !== "triagem") {
      return { position: ahead + 1, minutes: nA ? Math.ceil((ahead * st.config.avgMin) / nA) : null };
    }
    const nT = openStations(st, q.serviceId, "triagem");
    const aheadAll = sorted(null).indexOf(q);
    const minutes =
      nT && nA
        ? Math.ceil((ahead * avgFor(st, q.serviceId, "triagem")) / nT + (aheadAll * st.config.avgMin) / nA)
        : null;
    return { position: ahead + 1, minutes };
  }

  function confirmRisk(st, sessionId, itemId, level) {
    const q = byId(session(st, sessionId).queue, itemId);
    q.confirmedLevel = level;
    const e = q.entryId && byId(st.entries, q.entryId);
    if (e) e.confirmedLevel = level;
    if (level === "urgente") {
      q.blockers = [];
      if (q.presence === "remoto") notify(st, q.patientId, "Venha agora: seu atendimento foi priorizado.");
    }
    tick(st);
  }

  function announce(st, q, station) {
    st.tv.announcements.push({
      id: nextId(st, "t"),
      senha: q.senha,
      dest: station.name,
      serviceId: q.serviceId,
      at: st.now,
    });
  }

  function finishCurrent(st, s, station) {
    const q = station.current && byId(s.queue, station.current);
    station.current = null;
    if (!q) return;
    if (station.stage === "triagem") {
      // RN-TRI-04: o triado entra presente na fila do consultório, mesma senha e número.
      q.stage = "atendimento";
      q.status = "fila";
      q.stationId = null;
      q.calledAt = null;
      q.leaveHomeSent = false;
      becomeEligible(st, s, q, { applyLate: false });
      notify(st, q.patientId, `Triagem concluída. Aguarde na sala: o consultório vai chamar a senha ${q.senha}.`);
      return;
    }
    q.status = "atendido";
    const e = q.entryId && byId(st.entries, q.entryId);
    if (e) e.status = "concluida";
  }

  function callNext(st, sessionId, stationId) {
    const s = session(st, sessionId);
    const station = byId(st.stations, stationId);
    finishCurrent(st, s, station);
    const q = callOrder(st, sessionId, stationId)[0];
    if (!q) {
      tick(st);
      return { ok: false, error: "ninguem" };
    }
    q.status = "chamado";
    q.calledAt = st.now;
    q.stationId = stationId;
    station.current = q.id;
    s.maxCalled[q.stage] = Math.max(s.maxCalled[q.stage] || 0, q.number);
    s.queue.forEach((x) => {
      x.blockers = x.blockers.filter((b) => b !== q.id); // a trava acaba quando o travador é chamado
    });
    announce(st, q, station);
    notify(st, q.patientId, `Sua vez: senha ${q.senha}, ${service(st, q.serviceId).name}, ${station.name}.`);
    tick(st);
    return { ok: true, item: q };
  }

  function recall(st, sessionId, stationId) {
    const station = byId(st.stations, stationId);
    const q = station.current && byId(session(st, sessionId).queue, station.current);
    if (!q) return { ok: false, error: "ninguem" };
    announce(st, q, station); // tolerância não reinicia
    return { ok: true, item: q };
  }

  function finish(st, sessionId, stationId) {
    finishCurrent(st, session(st, sessionId), byId(st.stations, stationId));
    tick(st);
  }

  // RN-CHAM-03: 1º pulo presente atrás de K; 2º remoto; 3º sai da fila.
  function skip(st, sessionId, stationId) {
    const s = session(st, sessionId);
    const station = byId(st.stations, stationId);
    const q = station.current && byId(s.queue, station.current);
    if (!q) return { ok: false, error: "ninguem" };
    station.current = null;
    q.skips++;
    q.stationId = null;
    if (q.skips === 1) {
      q.status = "fila";
      becomeEligible(st, s, q, { applyLate: false });
      notify(st, q.patientId, `Você foi pulado (senha ${q.senha}). Continue na unidade: será chamado em breve.`);
    } else if (q.skips === 2) {
      q.status = "fila";
      q.presence = "remoto";
      releaseLocks(s, q);
      notify(
        st,
        q.patientId,
        `Você foi pulado de novo e voltou para remoto. Ao chegar, leia o QR: você vai para o fim.`,
      );
    } else {
      q.status = "saiu";
      releaseLocks(s, q);
      const e = q.entryId && byId(st.entries, q.entryId);
      if (e) e.status = "encerrada";
      const p = q.patientId && patient(st, q.patientId);
      if (p) p.faltas.push(st.now);
      notify(st, q.patientId, `Você saiu da fila por não comparecer à chamada 3 vezes.`);
    }
    tick(st);
    return { ok: true, item: q };
  }

  // RN-FILA-03: balcão entra presente com o próximo número.
  function frontDesk(st, sessionId, { name, birth, answers }) {
    const s = session(st, sessionId);
    const age = ageAt(birth, st.now);
    const c = classify(answers, age);
    if (c.level === "emergencia") return { ok: false, error: "emergencia", classification: c };
    if (occupied(st, sessionId) >= s.slots) return { ok: false, error: "sem_vagas" };
    const q = newItem(st, s, {
      patientId: null,
      name,
      suggested: c.level,
      confirmedLevel: null,
      legal: legalPriority(age, answers.grupos, null),
      origin: "balcao",
    });
    becomeEligible(st, s, q, { applyLate: false });
    tick(st);
    return { ok: true, item: q, classification: c };
  }

  // AD-006: a tolerância é só um contador; quem pula é o profissional ("Não compareceu").
  function tolerance(st, sessionId, stationId) {
    const station = byId(st.stations, stationId);
    const q = station.current && byId(session(st, sessionId).queue, station.current);
    if (!q) return null;
    const leftMs = Math.max(0, st.config.toleranceMin * MIN - (st.now - q.calledAt));
    return { leftMs, expired: leftMs === 0 };
  }

  // RN-TRI-01: a triagem é configuração do serviço; não muda com sessão aberta.
  function setServiceTriage(st, serviceId, on) {
    if (st.sessions.some((x) => x.serviceId === serviceId && x.state === "aberta"))
      return { ok: false, error: "sessao_aberta" };
    service(st, serviceId).requiresTriage = !!on;
    return { ok: true };
  }

  function createStation(st, { name, stage, services }) {
    const station = { id: nextId(st, "est"), name, stage, services, open: true, current: null };
    st.stations.push(station);
    return station;
  }

  // Prazo que depende do relógio: "saia de casa".
  function tick(st) {
    for (const s of st.sessions.filter((x) => x.state === "aberta")) {
      for (const q of s.queue) {
        if (q.status !== "fila" || q.presence !== "remoto" || q.leaveHomeSent || !q.patientId) continue;
        const { minutes } = eta(st, s.id, q.id);
        if (minutes !== null && minutes <= st.config.leaveHomeMin) {
          q.leaveHomeSent = true;
          notify(st, q.patientId, `Saia de casa: sua vez está chegando (~${minutes} min).`);
        }
      }
    }
  }

  // "Nenhum destes" e "Nenhuma" são exclusivos: marcá-los desmarca as outras opções (fonte 7.3).
  function toggleOption(selected, value, noneValue) {
    if (selected.includes(value)) return selected.filter((x) => x !== value);
    if (value === noneValue) return [noneValue];
    return [...selected.filter((x) => x !== noneValue), value];
  }

  const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
  const DAYMONTH = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  function dayLabel(t) {
    const w = WEEKDAY.format(t).split("-")[0];
    return `${w.charAt(0).toUpperCase()}${w.slice(1)}, ${DAYMONTH.format(t)}`;
  }

  // RN-AG-01: horário e sessões futuras com serviço, dia, visibilidade e vagas restantes. Sem pacientes (RN-AG-02).
  function unitAgenda(st, unitId) {
    const unit = byId(st.units, unitId);
    const svcIds = st.services.filter((x) => x.unitId === unitId).map((x) => x.id);
    const sessions = st.sessions
      .filter((s) => svcIds.includes(s.serviceId) && s.start > st.now)
      .sort((a, b) => a.start - b.start)
      .map((s) => {
        const left = s.slots - occupied(st, s.id);
        return {
          sessionId: s.id,
          serviceId: s.serviceId,
          left,
          text: `${dayLabel(s.start)} · ${service(st, s.serviceId).name} · ${s.visibility} · ${left} vagas`,
        };
      });
    return { name: unit.name, hours: unit.hours, sessions };
  }

  function newTvCode(st) {
    st.tv.code = String(100000 + ((st.seq * 7919 + 482913) % 900000));
  }

  // RN-TV-01: o admin digita o código mostrado na TV.
  function pairTv(st, code) {
    if (st.tv.paired || code !== st.tv.code) return { ok: false, error: "codigo" };
    st.tv.paired = true;
    return { ok: true };
  }

  function revokeTv(st) {
    st.tv.paired = false;
    st.seq++;
    newTvCode(st);
  }

  // RN-TV-02 e RN-TV-05: sem pareamento, só o código; pareada, só senhas e contadores.
  function tvView(st) {
    if (!st.tv.paired) return { paired: false, code: st.tv.code };
    const open = st.sessions.filter((s) => s.state === "aberta");
    const counters = open.map((s) => {
      const q = s.queue.filter((x) => x.status === "fila");
      return {
        name: service(st, s.serviceId).name,
        aguardando: q.filter((x) => x.presence === "presente").length,
        caminho: q.filter((x) => x.presence === "remoto").length,
      };
    });
    return {
      paired: true,
      announcements: st.tv.announcements.map((a) => ({
        id: a.id,
        senha: a.senha,
        dest: a.dest,
        service: service(st, a.serviceId).name,
        at: a.at,
      })),
      counters,
      qr: open.length ? qrToken(open[0], st.now) : null,
      qrSessionId: open.length ? open[0].id : null,
    };
  }

  // INV-06: o app do paciente recebe só os dados dele.
  function patientView(st, patientId) {
    const entries = st.entries.filter((e) => e.patientId === patientId);
    let queue = null;
    for (const s of st.sessions) {
      const q = [...s.queue].reverse().find((x) => x.patientId === patientId);
      if (!q) continue;
      const station = q.stationId && byId(st.stations, q.stationId);
      queue = {
        sessionId: s.id,
        entryId: q.entryId,
        senha: q.senha,
        presence: q.presence,
        status: q.status,
        skips: q.skips,
        station: station ? station.name : null,
        eta: q.status === "fila" ? eta(st, s.id, q.id) : null,
        display: q.status === "fila" ? patientEta(st, s.id, q.id) : null,
      };
    }
    return {
      patient: patient(st, patientId),
      entries,
      notifications: st.notifications.filter((n) => n.patientId === patientId),
      queue,
    };
  }

  // O que o app mostra (RN-ETA-04 com AD-002 e AD-003).
  // Presente: posição na ordem de chamada real entre os presentes do serviço.
  // Remoto: RN-ETA-01; em 1º com estação aberta, "venha agora".
  function patientEta(st, sessionId, itemId) {
    const s = session(st, sessionId);
    const q = byId(s.queue, itemId);
    const n = openStations(st, q.serviceId, q.stage);
    if (q.presence === "presente") {
      const order = callOrder(st, sessionId, null, undefined, q.stage).filter((x) => x.serviceId === q.serviceId);
      const position = order.indexOf(q) + 1;
      const minutes = n ? Math.ceil(((position - 1) * avgFor(st, q.serviceId, q.stage)) / n) : null;
      return { mode: "presente", position, minutes, comeNow: false };
    }
    const e = eta(st, sessionId, itemId);
    return {
      mode: "remoto",
      position: e.position,
      minutes: e.minutes,
      comeNow: e.position === 1 && e.minutes !== null,
    };
  }

  function etaText(eta) {
    if (!eta) return "";
    if (eta.comeNow) return "Sua vez está chegando: venha agora. Você só é chamado depois de ler o QR na unidade.";
    if (eta.minutes === null) return `você é o ${eta.position}º · aguardando início do atendimento`;
    if (eta.mode === "presente") return `você é o ${eta.position}º a ser chamado · ~${eta.minutes} min`;
    return `você é o ${eta.position}º · ~${eta.minutes} min`;
  }

  function advance(st, ms) {
    st.now += ms;
    tick(st);
  }

  const api = {
    MIN,
    DAY,
    QR_STEP,
    RISK_LABEL,
    createState,
    ageAt,
    classify,
    legalPriority,
    createEntry,
    acceptReferral,
    rejectReferral,
    suggest,
    occupied,
    allocate,
    callList,
    confirmAllocation,
    refuseAllocation,
    qrToken,
    openSession,
    callOrder,
    checkIn,
    markPresent,
    leave,
    eta,
    confirmRisk,
    callNext,
    recall,
    finish,
    skip,
    frontDesk,
    tick,
    toggleOption,
    dayLabel,
    unitAgenda,
    pairTv,
    revokeTv,
    tvView,
    patientView,
    advance,
    tolerance,
    setServiceTriage,
    createStation,
    etaText,
    patientEta,
    activeEntry,
    findItem,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
