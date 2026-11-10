// Telas do protótipo sobre o estado do engine.js.
// fluxo.html: <body data-story="principal">, a lição guiada.
(() => {
  const E = window.Engine;
  const S = window.Scenarios;
  const { MIN, DAY } = E;
  const { QUIZ, emptyAnswers, SCENARIOS } = S;
  const TZ = "America/Sao_Paulo";
  const STORY = document.body.dataset.story;

  let st;
  let ui;

  // ---------- Utilidades ----------

  const fmt = (o) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit" });
  const fDate = fmt({ day: "2-digit", month: "2-digit" });
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const byId = (list, id) => list.find((x) => x.id === id);
  const patient = (id) => byId(st.patients, id);
  const service = (id) => byId(st.services, id);
  const sessionOf = (id) => byId(st.sessions, id);
  const unitOf = (serviceId) => byId(st.units, service(serviceId).unitId);
  const first = (name) => name.split(" ")[0];
  const initials = (name) =>
    name
      .split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join("");
  const age = (p) => E.ageAt(p.birth, st.now);
  const openSession = () => st.sessions.find((s) => s.state === "aberta");
  const scenario = () => SCENARIOS[ui.scenario];
  const levelChip = (level, confirmed) =>
    `<span class="chip ${level}">${E.RISK_LABEL[level]}${confirmed === undefined ? "" : confirmed ? " · confirmado" : " · sugerido"}</span>`;
  const STATUS = {
    aguardando_encaminhamento: ["Aguardando encaminhamento", "atencao"],
    aguardando: ["Na lista de espera", "rotina"],
    alocada: ["Vaga reservada · confirme", "violet"],
    confirmada: ["Confirmada", "ok"],
    na_fila: ["Na fila de hoje", "ok"],
    concluida: ["Atendida", ""],
    encerrada: ["Encerrada sem atendimento", "urgente"],
    cancelada: ["Cancelada", ""],
  };
  const statusChip = (s) => `<span class="chip ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

  function beep() {
    try {
      const ctx = ui.audio;
      if (!ctx) return;
      for (const [f, t] of [
        [880, 0],
        [660, 0.25],
      ]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.45);
      }
    } catch {
      // sem som, a demo segue
    }
  }

  // Efeitos sonoros da lição, no estilo Duolingo (Web Audio, sem arquivos).
  const SFX = {
    tap: [[["triangle", 520, 0, 0.06, 0.12]]],
    correct: [[["triangle", 1047, 0, 0.12, 0.22], ["triangle", 1319, 0.11, 0.26, 0.22], ["sine", 2637, 0.11, 0.2, 0.05]]],
    alert: [[["sine", 988, 0, 0.14, 0.3], ["sine", 1319, 0.16, 0.14, 0.3], ["sine", 988, 0.32, 0.14, 0.3], ["sine", 1319, 0.48, 0.3, 0.3]]],
    fanfare: [[["triangle", 523, 0, 0.14, 0.22], ["triangle", 659, 0.13, 0.14, 0.22], ["triangle", 784, 0.26, 0.14, 0.22], ["triangle", 1047, 0.39, 0.5, 0.25], ["sine", 1319, 0.39, 0.5, 0.12], ["sine", 1568, 0.39, 0.5, 0.1]]],
  };
  let soundOn = true;
  try {
    soundOn = localStorage.getItem("fila-som") !== "off";
  } catch {
    // sem storage, som ligado
  }

  function sfxInit() {
    try {
      ui.sfx = ui.sfx || new (window.AudioContext || window.webkitAudioContext)();
      if (ui.sfx.state === "suspended") ui.sfx.resume();
    } catch {
      ui.sfx = null;
    }
  }

  function sfx(name) {
    const ctx = ui.sfx;
    if (!soundOn || !ctx || ui.skipping) return;
    try {
      const now = ctx.currentTime + 0.01;
      for (const [type, f, t, d, vol] of SFX[name][0]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + t);
        g.gain.exponentialRampToValueAtTime(vol, now + t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
        o.connect(g).connect(ctx.destination);
        o.start(now + t);
        o.stop(now + t + d + 0.05);
      }
    } catch {
      // sem som, a demo segue
    }
  }

  // ---------- Carregar ----------

  function load(key) {
    const sc = SCENARIOS[key];
    st = sc.setup();
    ui = {
      scenario: key,
      persona: sc.personas[0],
      screen: "home",
      unitId: null,
      entryId: null,
      quiz: null,
      result: null,
      sheet: null,
      qrMsg: null,
      toast: null,
      alerts: {},
      toasted: new Set(st.notifications.map((n) => n.id)),
      read: new Set(),
      tab: sc.tab,
      agSessionId: st.sessions.find((s) => s.visibility === "privada" && s.state === "planejada")?.id,
      agSel: null,
      agKey: null,
      agStale: false,
      agVersion: null,
      agMsg: null,
      callMsg: null,
      desk: { name: "", birth: "1960-01-01", answers: emptyAnswers() },
      deskResult: null,
      triLevel: {},
      tvCode: "",
      tvMsg: null,
      tvStarted: !!sc.tvReady,
      tvCur: null,
      tvPending: [],
      tvSeen: new Set(),
      tvShown: [],
      stationId: "st1",
      stationMsg: null,
      stLevel: null,
      newSession: { serviceId: "cli", day: 1, slots: 15, visibility: "privada" },
      simMsg: null,
      travelDone: new Set(),
      newStation: { name: "Triagem 1", stage: "triagem" },
      events: new Set(),
      done: new Set(),
      lesson: { step: 0, view: "start" },
      audio: ui?.audio || null,
    };
    for (const el of Object.values(regions)) if (el) el._html = null;
    update(true);
  }

  // Tempo compacto para cartões: "30 min", "2 h", "2h45".
  function hShort(ms) {
    const m = Math.round(ms / MIN);
    if (m < 60) return `${m} min`;
    const r = m % 60;
    return r ? `${Math.floor(m / 60)}h${String(r).padStart(2, "0")}` : `${m / 60} h`;
  }

  // Duração curta: "40 min", "2 h 26 min".
  function h(ms) {
    const m = Math.round(ms / MIN);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
  }

  const fWeek = fmt({ weekday: "short" });
  const fDay = fmt({ day: "2-digit" });
  const fMonth = fmt({ month: "short" });

  // Cartão de sessão na agenda da unidade: bloco de data à esquerda, serviço e vagas à direita.
  function sessionCard(x) {
    const pct = x.slots ? Math.round((x.left / x.slots) * 100) : 0;
    return `<div class="card session-card">
      <div class="date-tile"><small>${fWeek.format(x.start).replace(".", "")}</small><b>${fDay.format(x.start)}</b><small>${fMonth.format(x.start).replace(".", "")}</small></div>
      <div class="session-info">
        <strong>${esc(service(x.serviceId).name)}</strong>
        <div class="session-meta"><span class="chip ${x.visibility === "privada" ? "violet" : "rotina"}">${x.visibility}</span><span>${fTime.format(x.start)}</span></div>
        <div class="slots-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <small class="muted">${x.left} de ${x.slots} vagas livres</small>
      </div>
    </div>`;
  }

  // ---------- Celular ----------

  function phoneHTML() {
    const v = E.patientView(st, ui.persona);
    const p = v.patient;
    const unread = v.notifications.filter((n) => !ui.read.has(n.id)).length;
    const toast =
      ui.toast && ui.toast.pid === ui.persona && Date.now() < ui.toast.until
        ? `<div class="toast"><span class="toast-title">Fila Saúde · agora</span>${esc(ui.toast.text)}</div>`
        : "";
    const head = (title, back = "home") => `
      <div class="app-head">
        ${back ? `<button class="icon-btn" data-act="go" data-screen="${back}" aria-label="Voltar">←</button>` : ""}
        <h3>${title}</h3>
        <button class="icon-btn" data-act="go" data-screen="inbox" aria-label="Notificações">🔔${unread ? `<span class="dot">${unread}</span>` : ""}</button>
      </div>`;
    let body = "";
    let foot = "";
    let title = "";
    let back = "home";

    switch (ui.screen) {
      case "home": {
        title = `Olá, ${esc(first(p.name))}`;
        back = null;
        const q = v.queue;
        let today = "";
        if (q && ["fila", "chamado"].includes(q.status)) {
          const come = q.display?.comeNow;
          today = `<button class="card tap today ${come ? "come" : ""}" data-act="go" data-screen="queue">
              <div class="row between"><span class="muted">Fila de hoje · ${esc(service(sessionOf(q.sessionId).serviceId).name)}</span><span class="chip">${q.presence === "presente" ? "na unidade" : "em casa"}</span></div>
              <div class="big">${q.senha}</div>
              <div>${q.status === "chamado" ? "É a sua vez!" : E.etaText(q.display)}</div>
            </button>`;
        }
        const entries = v.entries.filter((e) => e.status !== "cancelada");
        body = `
          ${today}
          <div class="map">${mapSvg()}</div>
          <p class="map-hint">Toque numa unidade para ver horários e vagas</p>
          <div class="section-title">Minhas solicitações</div>
          ${
            entries.length
              ? entries
                  .map(
                    (e) => `<button class="card tap" data-act="entry" data-id="${e.id}">
                      <div class="row between"><strong>${esc(service(e.serviceId).name)}</strong>${statusChip(e.status)}</div>
                      <div class="muted">${esc(unitOf(e.serviceId).name)} · desde ${fDate.format(e.createdAt)}</div>
                    </button>`,
                  )
                  .join("")
              : `<p class="muted">Nenhuma ainda.</p>`
          }`;
        break;
      }
      case "unit": {
        const unit = byId(st.units, ui.unitId);
        const agenda = E.unitAgenda(st, ui.unitId);
        title = esc(unit.name);
        body = `
          <div class="row wrap"><span class="chip">${unit.type}</span><span class="muted">${esc(unit.address)}</span></div>
          <div class="section-title">Horário</div>
          <div>${agenda.hours}</div>
          <div class="section-title">Próximas sessões</div>
          ${agenda.sessions.map(sessionCard).join("") || `<p class="muted">Sem sessões futuras.</p>`}
          <div class="section-title">Serviços</div>
          ${st.services
            .filter((s) => s.unitId === unit.id)
            .map((s) =>
              s.appEntry === false
                ? `<div class="card svc locked"><span class="svc-icon" aria-hidden="true">🔒</span>
                    <div><strong>${esc(s.name)}</strong><div class="muted">Inscrição na recepção</div></div></div>`
                : `<div class="card svc"><span class="svc-icon" aria-hidden="true">🩺</span>
                    <div><strong>${esc(s.name)}</strong>${s.requiresReferral ? `<div class="muted">exige encaminhamento</div>` : ""}</div>
                    <button class="btn sm" data-act="join" data-id="${s.id}">Entrar na lista</button></div>`,
            )
            .join("")}`;
        break;
      }
      case "quiz": {
        const qz = ui.quiz;
        const steps = quizSteps(qz);
        const stepDef = steps[qz.step];
        title = esc(service(qz.serviceId).name);
        back = "unit";
        const pct = Math.round(((qz.step + 1) / steps.length) * 100);
        if (stepDef === "foto") {
          body = `
            <div class="quiz-progress"><span style="width:${pct}%"></span></div>
            <p class="quiz-q">Foto do encaminhamento</p>
            <p class="muted quiz-hint">Fotografe a requisição do médico. O agendador confere se é para este serviço e se está na validade.</p>
            <div class="viewfinder">${qz.photo ? "✓ Foto pronta: requisicao.jpg" : "Aponte a câmera para a requisição"}</div>
            <button class="btn secondary block" data-act="photo" data-taken="${qz.photo}">${qz.photo ? "Tirar outra" : "Tirar foto"}</button>`;
          foot = `<button class="btn block" data-act="quiz-next" ${qz.photo ? "" : "disabled"}>Enviar</button>`;
        } else {
          const val = qz.answers[stepDef.key];
          const pressed = (id) => (stepDef.multi ? val.includes(id) : val === id);
          const opts = [...stepDef.opts, ...(stepDef.none ? [stepDef.none] : [])];
          body = `
            <div class="quiz-progress"><span style="width:${pct}%"></span></div>
            <p class="quiz-q">${stepDef.q}</p>
            <p class="muted quiz-hint">${stepDef.multi ? "Marque todas que se aplicam" : "Escolha uma"}</p>
            ${opts
              .map(
                ([id, label]) =>
                  `<button class="option ${stepDef.none && id === stepDef.none[0] ? "none" : ""}" aria-pressed="${pressed(id)}" data-act="quiz-opt" data-id="${id}">${label}</button>`,
              )
              .join("")}`;
          const answered = stepDef.multi ? val.length > 0 : val != null;
          foot = `<button class="btn block" data-act="quiz-next" ${answered ? "" : "disabled"}>Continuar</button>`;
        }
        break;
      }
      case "result": {
        const r = ui.result;
        if (r.kind === "emergencia") {
          body = `<div class="emergency">
            <div class="result"><div class="icon" style="background:#fff;color:var(--red-600)">!</div></div>
            <h4>Procure atendimento agora</h4>
            <p>O que você marcou pode ser uma emergência. Não espere na fila: ligue para o SAMU ou vá à emergência mais próxima.</p>
            <a class="call-btn" href="tel:192">Ligar 192 · SAMU</a>
            <p style="font-size:13px">Você não entrou na lista de espera.</p>
            <p></p>
            <button class="btn secondary block" data-act="go" data-screen="home">Voltar ao início</button>
          </div>`;
        } else if (r.kind === "support") {
          back = "unit";
          body = `<div class="result">
            <div class="icon" style="background:var(--violet-50);color:var(--violet-600)">♥</div>
            <h4>Você não está sozinho</h4>
            <p>Converse agora com alguém. O atendimento é gratuito, sigiloso e funciona 24 horas.</p>
          </div>
          <div class="support">
            <a href="tel:188"><span>CVV · conversar agora</span><span>188</span></a>
            <a href="tel:192"><span>SAMU · emergência</span><span>192</span></a>
          </div>
          <p class="muted">Se quiser, você pode seguir e entrar na lista. Sua solicitação vai como prioridade para a equipe.</p>`;
          foot = `<button class="btn block" data-act="support-continue">Continuar e entrar na lista</button>`;
        } else if (r.kind === "dup") {
          const e = byId(st.entries, r.entryId);
          body = `<div class="result">
            <div class="icon" style="background:var(--orange-50);color:var(--orange-700)">=</div>
            <h4>Você já está nesta lista</h4>
            <p>Só pode haver uma solicitação por serviço. Esta é a sua:</p>
          </div>
          <button class="card tap" data-act="entry" data-id="${e.id}">
            <div class="row between"><strong>${esc(service(e.serviceId).name)}</strong>${statusChip(e.status)}</div>
            <div class="muted">desde ${fDate.format(e.createdAt)}</div>
          </button>`;
        } else {
          const e = byId(st.entries, r.entryId);
          body = `<div class="result">
            <div class="icon" style="background:var(--primary-50);color:var(--primary-500)">✓</div>
            <h4>Você entrou na lista</h4>
            <p>${esc(service(e.serviceId).name)} · ${esc(unitOf(e.serviceId).name)}</p>
            <p>${levelChip(e.suggested, false)}</p>
            <p>A classificação é uma sugestão. A equipe da unidade confirma.${
              e.status === "aguardando_encaminhamento" ? " O agendador vai conferir seu encaminhamento." : ""
            } Você recebe um aviso quando tiver vaga.</p>
          </div>`;
          foot = `<button class="btn block" data-act="go" data-screen="home">Voltar ao início</button>`;
        }
        break;
      }
      case "entry": {
        const e = byId(st.entries, ui.entryId);
        const s = e.sessionId && sessionOf(e.sessionId);
        title = esc(service(e.serviceId).name);
        let action = "";
        if (e.status === "alocada")
          action = `<div class="card" style="border-color:var(--primary-500)">
            <strong>Você tem uma vaga!</strong>
            <p>${E.dayLabel(s.start)} · ${fTime.format(s.start)} · ${esc(unitOf(s.serviceId).name)}</p>
            <p class="muted">Confirme até ${E.dayLabel(e.deadline)}, ${fTime.format(e.deadline)}.</p>
            <p></p>
            <div class="row"><button class="btn success sm" data-act="confirm-alloc" data-id="${e.id}">Confirmar</button>
            <button class="btn secondary sm" data-act="refuse-alloc" data-id="${e.id}">Não vou poder ir</button></div>
          </div>`;
        if (e.status === "confirmada")
          action = `<div class="banner ok">Confirmado para ${E.dayLabel(s.start)}, ${fTime.format(s.start)}. Quando a sessão abrir, você entra na fila e acompanha daqui, de casa.</div>`;
        if (e.status === "na_fila")
          action = `<button class="btn block" data-act="go" data-screen="queue">Ver minha fila</button>`;
        if (e.referral?.status === "rejeitado")
          action = `<div class="banner error">Encaminhamento rejeitado: ${esc(e.referral.reason)}</div>`;
        body = `
          <div class="row between"><span>${statusChip(e.status)}</span>${levelChip(e.confirmedLevel || e.suggested, !!e.confirmedLevel)}</div>
          <div class="section-title">Detalhes</div>
          <div class="card">
            <div>${esc(unitOf(e.serviceId).name)}</div>
            <div class="muted">Na lista desde ${fDate.format(e.createdAt)}</div>
            ${e.referral ? `<div class="muted">Encaminhamento: ${e.referral.status}</div>` : ""}
          </div>
          ${action}`;
        break;
      }
      case "queue": {
        const q = v.queue;
        title = "Fila de hoje";
        if (!q) {
          body = `<p class="muted">Você não está numa fila hoje.</p>`;
          break;
        }
        const svc = service(sessionOf(q.sessionId).serviceId);
        const stageTag = q.stage === "triagem" ? " · triagem" : svc.requiresTriage ? " · consultório" : "";
        if (q.status === "chamado") {
          body = `<div class="ticket called"><div class="svc">É a sua vez!</div><div class="senha">${q.senha}</div><div class="pos">${esc(svc.name)} → ${esc(q.station)}</div></div>
          <p class="muted">Vá até a sala agora. Você tem ${st.config.toleranceMin} minutos.</p>`;
        } else if (q.status === "atendido") {
          body = `<div class="ticket come"><div class="svc">${esc(svc.name)}</div><div class="senha">${q.senha}</div><div class="pos">Atendimento concluído</div></div>
            <div class="result"><h4>Tudo certo, ${esc(first(p.name))}!</h4><p>Você foi atendida sem enfrentar fila.</p></div>
            <div class="stat-grid"><div class="stat"><b>${h(q.presentMs)}</b><span>na unidade</span></div><div class="stat"><b>${q.awayMs === null ? "—" : h(q.awayMs)}</b><span>esperando em casa</span></div></div>`;
        } else if (q.status === "saiu") {
          body = `<div class="banner error">Você saiu da fila por não comparecer à chamada 3 vezes. Para outro dia, entre de novo na lista de espera.</div>`;
        } else {
          const d = q.display;
          const here = q.presence === "presente";
          const tri = q.stage === "triagem";
          // Caminho do dia: casa → (triagem) → consulta.
          const path = [["casa", "🏠", "Em casa"], ...(svc.requiresTriage ? [["triagem", "🩺", "Triagem"]] : []), ["consulta", "👩‍⚕️", "Consulta"]];
          const cur = !here ? 0 : tri ? 1 : path.length - 1;
          const triDone = svc.requiresTriage && !tri;
          const pathHTML = path
            .map(([id, icon, label], i) => {
              const state = i === cur ? "now" : (id === "triagem" && triDone) || i < cur ? "done" : "";
              return `<li class="${state}"><span class="dot" aria-hidden="true">${state === "done" ? "✓" : icon}</span><small>${label}</small></li>`;
            })
            .join("");
          const tip = here
            ? "Fique na sala. Sua senha aparece na TV."
            : d.comeNow
              ? "Pode vir. Ao chegar, leia o QR da TV."
              : "Espere em casa. Avisamos a hora de sair.";
          const stats = d.comeNow
            ? `<div class="q-come">Venha agora</div>`
            : `<div class="q-stats">
                <div><small>${tri ? "Na triagem" : "Sua posição"}</small><b>${d.position}º</b></div>
                <div><small>Tempo estimado</small><b>${d.minutes === null ? "—" : `~${hShort(d.minutes * MIN)}`}</b></div>
              </div>`;
          body = `
            <div class="q-ticket"><small>Sua senha</small><span class="senha">${q.senha}</span><span class="svc">${esc(svc.name)}</span></div>
            ${stats}
            ${d.minutes === null && !d.comeNow ? `<p class="q-tip">Aguardando o início do atendimento.</p>` : ""}
            ${tri && d.consultMinutes != null ? `<div class="q-next">👩‍⚕️ Consulta prevista em ~${h(d.consultMinutes * MIN)}</div>` : ""}
            <ol class="q-path">${pathHTML}</ol>
            ${ui.qrMsg ? `<div class="q-msg ${ui.qrMsg.ok ? "" : "error"}">${ui.qrMsg.text}</div>` : ""}
            <p class="q-tip">${tip}</p>
            ${q.skips ? `<span class="chip urgente">${q.skips} pulo${q.skips > 1 ? "s" : ""}</span>` : ""}`;
          foot =
            q.presence === "remoto"
              ? `<button class="btn block" data-act="sheet" data-id="qr">Cheguei: ler QR da TV</button>`
              : `<button class="btn secondary block" data-act="leave">Vou sair</button>`;
        }
        break;
      }
      case "inbox": {
        title = "Notificações";
        body =
          [...v.notifications]
            .reverse()
            .map(
              (n) => `<div class="notif">${esc(n.text)}<time>${E.dayLabel(n.at)}, ${fTime.format(n.at)}</time></div>`,
            )
            .join("") || `<p class="muted">Nada por aqui.</p>`;
        break;
      }
    }

    const sheet =
      ui.sheet === "qr"
        ? `<div class="scrim" data-act="sheet" data-id=""></div>
          <div class="sheet">
            <strong>Ler QR de entrada</strong>
            <div class="viewfinder">Aponte a câmera para o QR na TV da sala de espera</div>
            <button class="btn block" data-act="scan">Ler QR da TV</button>
            <p></p>
            <button class="btn ghost block sm" data-act="scan-old">Testar com foto antiga do QR</button>
          </div>`
        : "";
    const isEmergency = ui.screen === "result" && ui.result.kind === "emergencia";
    return `<div class="screen">
      <div class="statusbar"><span>${fTime.format(st.now)}</span><span>●●● 4G</span></div>
      ${toast}
      ${isEmergency ? "" : head(title, back)}
      <div class="app-body">${body}</div>
      ${foot ? `<div class="app-foot">${foot}</div>` : ""}
      ${sheet}
      ${alertScreenHTML(ui.persona)}
    </div>`;
  }

  function mapSvg() {
    const pins = st.units
      .map(
        (u) => `<g class="pin" data-act="unit" data-id="${u.id}" transform="translate(${u.x} ${u.y})">
          <path d="M0 0c-8-10-12-15-12-21a12 12 0 0 1 24 0c0 6-4 11-12 21z" fill="${u.type === "UBS" ? "oklch(0.6124 0.1566 252.06)" : "oklch(0.52 0.16 295)"}"/>
          <circle cy="-21" r="4.5" fill="#fff"/>
          <text y="12" text-anchor="middle" font-size="9" font-weight="800" fill="#2b3536">${esc(u.name)}</text>
        </g>`,
      )
      .join("");
    return `<svg viewBox="0 0 320 240" role="img" aria-label="Mapa de unidades">
      <rect width="320" height="240" fill="#eef4f5"/>
      <path d="M-10 120 Q80 100 160 130 T330 110" stroke="#fff" stroke-width="14" fill="none"/>
      <path d="M150 -10 L170 250" stroke="#fff" stroke-width="10" fill="none"/>
      <path d="M-10 40 L330 70" stroke="#fff" stroke-width="7" fill="none"/>
      <path d="M40 250 L90 -10" stroke="#fff" stroke-width="6" fill="none"/>
      <rect x="20" y="170" width="60" height="45" rx="8" fill="#dcebdc"/>
      <rect x="260" y="140" width="48" height="40" rx="8" fill="#dcebdc"/>
      <path d="M200 -10 Q230 40 330 30 L330 -10z" fill="#d6e6f2"/>
      <circle cx="165" cy="160" r="22" fill="oklch(0.6124 0.1566 252.06)" opacity=".12"/>
      <circle cx="165" cy="160" r="6" fill="oklch(0.6124 0.1566 252.06)" stroke="#fff" stroke-width="2.5"/>
      ${pins}
    </svg>`;
  }

  function quizSteps(qz) {
    const steps = QUIZ.filter((s) => !s.only || s.only(qz.answers));
    return service(qz.serviceId).requiresReferral ? [...steps, "foto"] : steps;
  }

  // ---------- Painel ----------

  // Sessão em alocação, sugestão e seleção atual (pré-marca as primeiras vagas livres).
  function allocState(sessions) {
    const s = sessionOf(ui.agSessionId) || sessions[0];
    ui.agSessionId = s.id;
    if (ui.agVersion === null) ui.agVersion = s.version;
    const sug = E.suggest(st, s.id);
    const free = s.slots - E.occupied(st, s.id);
    const key = `${s.id}:${free}:${st.config.priorityOrder}:${sug.map((x) => x.entry.id).join(",")}`;
    if (!ui.agStale && (ui.agSel === null || ui.agKey !== key)) {
      ui.agSel = new Set(sug.slice(0, Math.max(0, free)).map((x) => x.entry.id));
      ui.agKey = key;
    }
    return { s, sug, free };
  }

  function checkbox(group, id, label, list) {
    return `<label><input type="checkbox" data-act="desk-opt" data-group="${group}" data-id="${id}" ${list.includes(id) ? "checked" : ""}>${label}</label>`;
  }

  // 07:00 em Brasília, N dias depois do dia atual do relógio da demo.
  function dayStart(days) {
    const local = st.now - 3 * 60 * MIN;
    return Math.floor(local / DAY) * DAY + days * DAY + 10 * 60 * MIN;
  }

  // ---------- Lição guiada (fluxo.html) ----------
  // Cada passo: intro (o que vem a seguir) → tela sozinha com destaque → "muito bem" → próximo.

  const SCREEN_LABEL = {
    phone: "Celular da Maria",
    "new-session": "Painel da unidade",
    sessions: "Painel da unidade",
    allocate: "Painel do agendador",
    station: "Estação de chamada",
    tv: "TV da sala de espera",
  };

  function lessonStep(i = ui.lesson.step) {
    return i === null ? null : scenario().story.steps[i];
  }

  function enterStep(step) {
    if (step.persona) ui.persona = step.persona;
    if (step.tab) ui.tab = step.tab;
    if (step.station) {
      const target = st.stations.find((x) => x.stage === step.station);
      if (target && ui.stationId !== target.id) {
        ui.stationId = target.id;
        ui.stationMsg = null;
        ui.stLevel = null;
      }
    }
  }

  function runGuidedStep() {
    const step = lessonStep();
    if (!step) return;
    enterStep(step);
    const sels = stepTargets(step) || [];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el || el.disabled) continue;
      const fn = actions[el.dataset.act];
      if (!fn) continue;
      if (el.dataset.act !== "sim") ui.simMsg = null;
      fn(el.dataset);
      return;
    }
  }

  function stepTargets(step) {
    const t = typeof step.targets === "function" ? step.targets(st, ui) : step.targets;
    if (step.screen === "phone" && activeAlert(ui.persona)) return [".alert-screen .alert-main", ...t];
    return t;
  }

  function currentStep() {
    const steps = scenario().story.steps;
    const i = steps.findIndex((_, k) => !ui.done.has(k));
    return i === -1 ? null : i;
  }

  function lessonTopHTML() {
    const total = scenario().story.steps.length;
    const pct = Math.round((ui.done.size / total) * 100);
    return `<div class="lesson-top-inner">
      <a class="lesson-x" href="index.html" aria-label="Sair do fluxo">✕</a>
      <div class="lesson-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${ui.done.size}" aria-label="Progresso"><span style="width:${pct}%"></span></div>
      <button class="lesson-sound" data-act="lesson-sound" aria-pressed="${soundOn}" aria-label="${soundOn ? "Desligar som" : "Ligar som"}">${soundOn ? "🔊" : "🔇"}</button>
    </div>`;
  }

  function sayHTML(text) {
    return `<div class="lesson-say"><img src="assets/mascote.svg" alt="" width="200" height="200" /><div class="bubble">${text}</div></div>`;
  }

  function stepClock(step) {
    return typeof step.clock === "function" ? step.clock(st, ui) : step.clock;
  }

  function waitBarHTML(clock) {
    const btn =
      clock === "day"
        ? `<button class="btn" data-act="adv" data-ms="${DAY}">Avançar 1 dia</button>`
        : `<button class="btn" data-act="sim">Esperar até o próximo aviso</button>`;
    return `<div class="lesson-clock"><time>🕒 ${fDate.format(st.now)} · ${fTime.format(st.now)}</time>${btn}</div>`;
  }

  // Telas da lição: só o necessário para o passo, em cartões grandes.

  function newSessionScreen() {
    const ns = ui.newSession;
    const svc = service(ns.serviceId);
    const tile = (id, icon, title, sub) =>
      `<button class="tile ${ns.visibility === id ? "on" : ""}" data-act="ns-vis" data-id="${id}" aria-pressed="${ns.visibility === id}"><span class="tile-icon">${icon}</span><b>${title}</b><small>${sub}</small></button>`;
    return `<div class="card-screen">
      <div class="facts">
        <div><small>Serviço</small><b>${esc(svc.name)}</b></div>
        <div><small>Dia</small><b>${E.dayLabel(dayStart(ns.day))} · 07:00</b></div>
        <div><small>Vagas</small><b>${esc(String(ns.slots))}</b></div>
      </div>
      <div class="tiles">
        ${tile("privada", "🔒", "Privada", "o agendador escolhe quem entra")}
        ${tile("pública", "🌐", "Pública", "o paciente se inscreve sozinho")}
      </div>
      ${ui.nsMsg ? `<div class="banner error">${ui.nsMsg}</div>` : ""}
      <button class="btn lg block" data-act="session-create">Criar sessão</button>
    </div>`;
  }

  function sessionsScreen() {
    const list = st.sessions.filter((x) => x.state === "planejada" || x.state === "aberta");
    return `<div class="card-screen">${list
      .map(
        (x) => `<div class="tile static">
          <span class="tile-icon">📅</span>
          <b>${esc(service(x.serviceId).name)}</b>
          <small>${E.dayLabel(x.start)} · ${fTime.format(x.start)} · ${E.occupied(st, x.id)} de ${x.slots} vagas</small>
        </div>
        ${x.state === "planejada" ? `<button class="btn lg block" data-act="open-session" data-id="${x.id}">Abrir sessão</button>` : `<span class="chip ok">aberta</span>`}`,
      )
      .join("")}</div>`;
  }

  function allocateScreen() {
    const sessions = st.sessions.filter((x) => x.visibility === "privada" && x.state === "planejada");
    if (!sessions.length) return `<div class="card-screen"><p class="muted">Nenhuma sessão para alocar.</p></div>`;
    const { s, sug, free } = allocState(sessions);
    const me = scenario().protagonist;
    const n = sug.filter((x) => ui.agSel.has(x.entry.id)).length;
    const cap = (t) => t[0].toUpperCase() + t.slice(1);
    const rows = sug
      .map((x, i) => {
        const e = x.entry;
        const p = patient(e.patientId);
        const on = ui.agSel.has(e.id);
        const level = e.confirmedLevel || e.suggested;
        const days = Math.floor((st.now - e.createdAt) / DAY);
        return `<tr class="${on ? "on" : ""} ${e.patientId === me ? "me" : ""}" data-act="ag-toggle" data-id="${e.id}" aria-selected="${on}">
          <td class="c-check"><span class="check" aria-hidden="true">${on ? "✓" : ""}</span></td>
          <td class="c-rank">${i + 1}º</td>
          <td><div class="c-who"><span class="av" aria-hidden="true">${initials(p.name)}</span><span><b>${esc(p.name)}</b><small>${age(p)} anos</small>${e.legal.label ? `<span class="pill legal m-only">${esc(cap(e.legal.label))}</span>` : ""}</span></div></td>
          <td><span class="pill ${level}">${E.RISK_LABEL[level]}</span></td>
          <td class="c-legal">${e.legal.label ? `<span class="pill legal">${esc(cap(e.legal.label))}</span>` : `<span class="none">—</span>`}</td>
          <td class="c-wait">${days === 0 ? "hoje" : `${days} dias`}</td>
        </tr>`;
      })
      .join("");
    const pct = Math.round((n / Math.max(1, free)) * 100);
    return `<div class="card-screen alloc">
      <div class="alloc-top">
      <div class="alloc-session">
        <div class="date-tile"><small>${fWeek.format(s.start).replace(".", "")}</small><b>${fDay.format(s.start)}</b><small>${fMonth.format(s.start).replace(".", "")}</small></div>
        <div><b>${esc(service(s.serviceId).name)}</b><small>${fTime.format(s.start)} · ordem: risco › prioridade › tempo de espera</small></div>
      </div>
      <div class="alloc-count">
        <div class="slot-label"><b>${n}</b> de ${free} vagas${free - n > 0 ? ` · sobram ${free - n}` : ""}</div>
        <div class="slots-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
      </div>
      </div>
      <div class="alloc-table-wrap">
        <table class="alloc-table">
          <thead><tr><th></th><th class="c-rank">#</th><th>Paciente</th><th>Risco</th><th class="c-legal">Prioridade</th><th>Espera</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="sticky-action"><button class="btn lg block" data-act="ag-alloc" ${n ? "" : "disabled"}>Alocar ${n} ${n === 1 ? "pessoa" : "pessoas"}</button></div>
    </div>`;
  }

  function stationScreen() {
    const station = byId(st.stations, ui.stationId);
    const s = openSession();
    const cur = s && station.current && byId(s.queue, station.current);
    const tri = station.stage === "triagem";
    // Na lição, só se finaliza o atendimento da protagonista: os outros a unidade atende sozinha.
    const mine = cur && cur.patientId === scenario().protagonist;
    return `<div class="card-screen">
      <div class="facts"><div><small>Estação</small><b>${esc(station.name)}</b></div></div>
      <div class="big-ticket ${cur ? "" : "empty"}">
        <small>${tri ? "Em triagem" : "Em atendimento"}</small>
        <span class="senha">${cur ? cur.senha : "—"}</span>
        ${cur ? `<b>${esc(cur.name)}</b>` : ""}
      </div>
      <button class="btn lg block" data-act="st-finish" ${mine ? "" : "disabled"}>${tri ? "Finalizar triagem" : "Finalizar atendimento"}</button>
    </div>`;
  }

  function tvScreen() {
    const last = E.tvView(st).announcements?.at(-1);
    return `<div class="tv-simple">
      <small>CHAMANDO AGORA</small>
      <span class="senha">${last ? last.senha : "—"}</span>
      <b>${last ? `${esc(last.service)} → ${esc(last.dest)}` : "aguardando a primeira chamada"}</b>
    </div>`;
  }

  function screenHTML(name) {
    if (name === "phone") return `<div class="phone">${phoneHTML()}</div>`;
    return {
      "new-session": newSessionScreen,
      sessions: sessionsScreen,
      allocate: allocateScreen,
      station: stationScreen,
      tv: tvScreen,
    }[name]();
  }

  function summaryHTML() {
    const q = E.patientView(st, scenario().protagonist).queue;
    const stat = (cls, label, value) =>
      `<div class="stat-card ${cls}"><small>${label}</small><b>${value}</b></div>`;
    return `<div class="stat-cards">
      ${stat("home", "Esperando em casa", q?.awayMs ? h(q.awayMs) : "—")}
      ${stat("unit", "Na unidade", q?.presentMs ? h(q.presentMs) : "—")}
      ${stat("steps", "Passos", String(scenario().story.steps.length))}
    </div>`;
  }

  function lessonMainHTML() {
    const { view } = ui.lesson;
    const story = scenario().story;
    if (view === "start")
      return `<div class="lesson-intro">
        <span class="lesson-kicker">Fila Saúde</span>
        <h1>${story.intro.title}</h1>
        ${sayHTML(story.intro.text)}
      </div>`;
    if (view === "end")
      return `<div class="lesson-intro center">
        <img src="assets/mascote.svg" alt="" width="160" height="160" />
        <h1>Maria foi atendida!</h1>
        <p class="lesson-sub">Ela esperou em casa e só foi à unidade na hora certa.</p>
        ${summaryHTML()}
      </div>`;
    const step = lessonStep();
    if (view === "intro")
      return `<div class="lesson-intro">
        <span class="lesson-kicker">${SCREEN_LABEL[step.screen]}</span>
        <h1>${step.title}</h1>
        ${sayHTML(step.text)}
      </div>`;
    const clock = view === "do" ? stepClock(step) : null;
    return `<div class="lesson-stage ${view === "ok" ? "locked" : ""}" data-screen="${step.screen}">
      ${clock ? waitBarHTML(clock) : ""}
      ${screenHTML(step.screen)}
    </div>`;
  }

  function lessonFooterHTML() {
    const { view } = ui.lesson;
    const inner = {
      start: `<span></span><button class="btn go" data-act="lesson-start">Começar</button>`,
      intro: `<span></span><button class="btn go" data-act="lesson-show">Mostrar tela</button>`,
      do: `<button class="btn secondary" data-act="lesson-skip">Pular</button>`,
      ok: `<div class="lesson-ok"><span class="lesson-ok-icon" aria-hidden="true">✓</span><div><h2>Muito bem!</h2>${ui.simMsg ? `<p>${ui.simMsg}</p>` : ""}</div></div><button class="btn go" data-act="lesson-next">Continuar</button>`,
      end: `<button class="btn secondary" data-act="restart">Ver de novo</button><a class="btn go" href="index.html">Voltar ao início</a>`,
    }[view];
    return `<div class="lesson-footer-inner">${inner}</div>`;
  }

  function lessonFooterClass() {
    const el = regions.lessonFooter;
    if (el) el.classList.toggle("ok", ui.lesson.view === "ok");
  }

  // ---------- Render ----------

  const regions = {
    lessonTop: document.getElementById("lesson-top"),
    lessonMain: document.getElementById("lesson-main"),
    lessonFooter: document.getElementById("lesson-footer"),
  };

  const RENDER = { lessonTop: lessonTopHTML, lessonMain: lessonMainHTML, lessonFooter: lessonFooterHTML };

  function put(el, html, force) {
    if (el._html === html) return;
    const a = document.activeElement;
    const busy = el.contains(a) && /INPUT|SELECT/.test(a.tagName);
    if (busy && !force) return;
    el.innerHTML = html;
    el._html = html;
  }

  function trackSteps() {
    if (openSession()) ui.events.add(`see:${ui.persona}`);
    scenario().story.steps.forEach((s, i) => {
      if (!ui.done.has(i) && s.done(st, ui)) ui.done.add(i);
    });
    if (ui.lesson.view === "do" && ui.done.has(ui.lesson.step)) {
      ui.lesson.view = "ok";
      sfx("correct");
    }
  }

  function applyHint() {
    for (const el of document.querySelectorAll(".hint")) el.classList.remove("hint");
    if (ui.lesson.view !== "do") return;
    for (const sel of stepTargets(lessonStep())) {
      const el = document.querySelector(sel);
      if (el) {
        el.classList.add("hint");
        const key = `${ui.lesson.step}:${sel}`;
        if (ui.hintKey !== key) {
          ui.hintKey = key;
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center" });
        }
        return;
      }
    }
  }

  function update(force = false) {
    checkToast();
    trackSteps();
    for (const [k, el] of Object.entries(regions)) if (el) put(el, RENDER[k](), force);
    lessonFooterClass();
    if (ui.scrollTo) {
      document.querySelector(ui.scrollTo)?.scrollIntoView({ block: "center" });
      ui.scrollTo = null;
    }
    applyHint();
  }

  function checkToast() {
    const fresh = st.notifications.filter((n) => !ui.toasted.has(n.id));
    for (const n of fresh) ui.toasted.add(n.id);
    for (const n of fresh) if (ALERT_RE.test(n.text)) ui.alerts[n.patientId] = n;
    if (fresh.some((n) => n.patientId === ui.persona && ALERT_RE.test(n.text))) sfx("alert");
    const mine = fresh.filter((n) => n.patientId === ui.persona && !ALERT_RE.test(n.text));
    if (mine.length) ui.toast = { pid: ui.persona, text: mine[mine.length - 1].text, until: Date.now() + 5000 };
  }

  // Avisos que pedem ação ocupam a tela inteira do celular até a pessoa responder.
  const ALERT_RE = /^(Você foi alocado|Saia de casa|Venha agora|Sua vez)/;

  function activeAlert(pid) {
    const n = ui.alerts[pid];
    if (!n) return null;
    if (n.text.startsWith("Você foi alocado")) {
      const e = st.entries.find((x) => x.patientId === pid && x.status === "alocada");
      if (!e) delete ui.alerts[pid];
      return e ? { n, e } : null;
    }
    const q = st.sessions.flatMap((x) => x.queue).find((x) => x.patientId === pid);
    const ok =
      q &&
      (n.text.startsWith("Sua vez")
        ? q.status === "chamado"
        : q.status === "fila" && q.presence === "remoto");
    if (!ok) {
      delete ui.alerts[pid];
      return null;
    }
    return { n, q };
  }

  function alertScreenHTML(pid) {
    const a = activeAlert(pid);
    if (!a) return "";
    const { n, q, e } = a;
    if (e) {
      const s = sessionOf(e.sessionId);
      return `<div class="alert-screen" role="alertdialog" aria-label="Você tem uma vaga!">
        <span class="alert-icon" aria-hidden="true">🎉</span>
        <h2>Você tem uma vaga!</h2>
        <span class="alert-senha">${esc(service(e.serviceId).name)}</span>
        <p>${E.dayLabel(s.start)}, às ${fTime.format(s.start)}. Confirme em até 24 h para garantir.</p>
        <button class="btn lg block alert-ok alert-main" data-act="confirm-alloc" data-id="${e.id}">Confirmar presença</button>
        <button class="btn ghost block alert-later" data-act="alert-ok">Agora não</button>
      </div>`;
    }
    let icon = "🏃";
    let title = "Hora de sair de casa!";
    let sub = "Sua vez está chegando.";
    let btn = "Estou indo";
    const min = n.text.match(/~(\d+) min/);
    if (n.text.startsWith("Saia de casa") && min) sub = `Faltam cerca de ${min[1]} min. Vá para a unidade e leia o QR da TV ao chegar.`;
    if (n.text.startsWith("Venha agora")) {
      icon = "⚡";
      title = "Venha agora!";
      sub = "Seu atendimento foi priorizado. Vá direto para a unidade.";
    }
    if (n.text.startsWith("Sua vez")) {
      icon = "🔔";
      title = "Sua vez!";
      sub = `Vá para: ${esc(n.text.split(", ").at(-1).replace(/\.$/, ""))}`;
      btn = "Ok, estou indo";
    }
    return `<div class="alert-screen" role="alertdialog" aria-label="${title}">
      <span class="alert-icon" aria-hidden="true">${icon}</span>
      <h2>${title}</h2>
      <span class="alert-senha">${q.senha}</span>
      <p>${sub}</p>
      <button class="btn lg block alert-ok alert-main" data-act="alert-ok">${btn}</button>
    </div>`;
  }

  // ---------- Ações ----------

  function startQuiz(serviceId) {
    const dup = E.activeEntry(st, ui.persona, serviceId);
    if (dup) {
      ui.result = { kind: "dup", entryId: dup.id };
      ui.screen = "result";
      ui.events.add("dup");
      return;
    }
    const prev = st.entries.filter((e) => e.patientId === ui.persona).pop();
    ui.quiz = {
      serviceId,
      step: 0,
      answers: emptyAnswers(prev ? [...prev.answers.grupos] : []),
      photo: false,
      supportOk: false,
    };
    ui.screen = "quiz";
  }

  function quizNext() {
    const qz = ui.quiz;
    const steps = quizSteps(qz);
    const stepDef = steps[qz.step];
    if (stepDef !== "foto" && stepDef.key === "alarms") {
      const c = E.classify({ ...emptyAnswers(), alarms: qz.answers.alarms }, 30);
      if (c.level === "emergencia") {
        ui.result = { kind: "emergencia" };
        ui.screen = "result";
        ui.events.add(`emergencia:${ui.persona}`);
        return;
      }
      if (c.support && !qz.supportOk) {
        ui.result = { kind: "support" };
        ui.screen = "result";
        return;
      }
    }
    if (qz.step < steps.length - 1) {
      qz.step++;
      return;
    }
    const r = E.createEntry(st, {
      patientId: ui.persona,
      serviceId: qz.serviceId,
      answers: qz.answers,
      referralPhoto: qz.photo ? "requisicao.jpg" : null,
    });
    ui.quiz = null;
    ui.screen = "result";
    if (r.ok) ui.result = { kind: "ok", entryId: r.entry.id };
    else if (r.error === "duplicada") {
      ui.result = { kind: "dup", entryId: r.existing.id };
      ui.events.add("dup");
    } else ui.result = { kind: "emergencia" };
  }

  function scan(old) {
    const s = openSession();
    if (!s) return;
    // Demonstração: depois de um "saia de casa", a protagonista leva o tempo do trajeto para chegar,
    // e a unidade segue trabalhando nesse meio-tempo.
    const sc = scenario();
    let travelled = 0;
    if (!old && sc.travelMin && ui.persona === sc.protagonist) {
      const last = st.notifications.filter((n) => n.patientId === ui.persona && n.text.includes("Saia de casa")).at(-1);
      const left = last ? sc.travelMin * MIN - (st.now - last.at) : 0;
      if (left > 0 && !ui.travelDone.has(last.id)) {
        ui.travelDone.add(last.id);
        E.simulate(st, s.id, { protagonist: ui.persona, maxMs: left });
        travelled = Math.round(left / MIN);
        const all = E.tvView(st).announcements || [];
        for (const a of all) ui.tvSeen.add(a.id);
        ui.tvShown = all.slice(-5).reverse();
      }
    }
    const token = E.qrToken(s, old ? st.now - 2 * MIN : st.now);
    const r = E.checkIn(st, s.id, ui.persona, token);
    ui.sheet = null;
    ui.qrMsg = r.ok
      ? {
          ok: true,
          text: `✓ Check-in feito${travelled ? ` · trajeto de ${travelled} min` : ""}`,
        }
      : {
          ok: false,
          text:
            r.error === "qr_invalido"
              ? "QR expirado. Leia o código que está na TV agora."
              : "Você não está nesta fila.",
        };
  }

  const actions = {
    scenario: (d) => load(d.id),
    restart: () => load(ui.scenario),
    "lesson-start": () => {
      ui.lesson.view = "intro";
    },
    "lesson-show": () => {
      enterStep(lessonStep());
      ui.scrollTo = ".alloc-table tr.me";
      ui.lesson.view = "do";
      ui.hintKey = null;
      window.scrollTo(0, 0);
    },
    "lesson-skip": () => {
      const at = ui.lesson.step;
      ui.skipping = true;
      for (let k = 0; k < 80 && !ui.done.has(at); k++) {
        runGuidedStep();
        update(true);
      }
      ui.skipping = false;
      if (ui.lesson.view === "ok") sfx("correct");
    },
    "lesson-sound": () => {
      soundOn = !soundOn;
      try {
        localStorage.setItem("fila-som", soundOn ? "on" : "off");
      } catch {
        // preferência só nesta aba
      }
      if (soundOn) sfx("tap");
    },
    "lesson-next": () => {
      const i = currentStep();
      ui.lesson = { step: i, view: i === null ? "end" : "intro" };
      sfx(i === null ? "fanfare" : "tap");
      ui.simMsg = null;
      window.scrollTo(0, 0);
    },
    adv: (d) => {
      E.advance(st, Number(d.ms));
      if (Number(d.ms) === DAY) ui.events.add("adv:day");
      ui.events.add(`adv:${d.ms}`);
    },
    persona: (d) => {
      ui.persona = d.persona;
      ui.screen = "home";
      ui.sheet = null;
      ui.qrMsg = null;
      ui.quiz = null;
      ui.toast = null;
    },
    "alert-ok": () => {
      const n = ui.alerts[ui.persona];
      if (n) ui.read.add(n.id);
      delete ui.alerts[ui.persona];
      ui.screen = n?.text.startsWith("Você foi alocado") ? "home" : "queue";
      ui.sheet = null;
    },
    go: (d) => {
      ui.screen = d.screen;
      ui.sheet = null;
      ui.qrMsg = null;
      if (d.screen === "inbox")
        for (const n of st.notifications.filter((x) => x.patientId === ui.persona)) ui.read.add(n.id);
    },
    unit: (d) => {
      ui.unitId = d.id;
      ui.screen = "unit";
      ui.events.add(`unit:${d.id}`);
    },
    join: (d) => startQuiz(d.id),
    "quiz-opt": (d) => {
      const qz = ui.quiz;
      const stepDef = quizSteps(qz)[qz.step];
      if (stepDef.multi) qz.answers[stepDef.key] = E.toggleOption(qz.answers[stepDef.key], d.id, stepDef.none[0]);
      else {
        qz.answers[stepDef.key] = d.id;
        if (stepDef.key === "motivo" && d.id !== "novo") qz.answers.gravidade = null;
      }
    },
    "quiz-next": quizNext,
    photo: () => {
      ui.quiz.photo = true;
    },
    "support-continue": () => {
      ui.quiz.supportOk = true;
      ui.screen = "quiz";
      quizNext();
    },
    entry: (d) => {
      ui.entryId = d.id;
      ui.screen = "entry";
    },
    "confirm-alloc": (d) => E.confirmAllocation(st, d.id),
    "refuse-alloc": (d) => {
      E.refuseAllocation(st, d.id);
      ui.events.add("refuse");
    },
    sheet: (d) => {
      ui.sheet = d.id || null;
    },
    scan: () => scan(false),
    "scan-old": () => scan(true),
    leave: () => {
      const s = openSession();
      const q = E.findItem(s, ui.persona);
      E.leave(st, s.id, ui.persona);
      if (q) {
        ui.events.add(`leave:${q.stage}`);
        ui.leaveAt = st.now;
      }
      ui.qrMsg = { ok: true, text: "Você está em casa de novo. Sua posição foi mantida." };
    },
    tab: (d) => {
      ui.tab = d.id;
    },
    rule: (d) => {
      st.config.priorityOrder = d.id;
      ui.agSel = null;
      ui.agStale = false;
    },
    "ag-toggle": (d) => {
      if (ui.agSel.has(d.id)) ui.agSel.delete(d.id);
      else ui.agSel.add(d.id);
    },
    "ag-alloc": () => {
      const n = ui.agSel.size;
      const r = E.allocate(st, ui.agSessionId, [...ui.agSel], { version: ui.agVersion });
      if (r.ok && scenario().autoConfirm) {
        // Demonstração: os outros pacientes confirmam pelo app; só a protagonista confirma com o seu clique.
        for (const e of st.entries)
          if (e.status === "alocada" && e.patientId !== scenario().protagonist) E.confirmAllocation(st, e.id);
      }
      if (r.ok)
        ui.agMsg = {
          ok: true,
          text: `${n} paciente(s) alocado(s). Cada um recebeu “confirme em 24 h” e entrou na lista de ligação.`,
        };
      else if (r.error === "conflito") {
        ui.agMsg = {
          ok: false,
          text: "Outro agendador alocou vagas desta sessão agora há pouco. A lista foi atualizada: revise e aloque de novo.",
        };
        ui.events.add("conflict");
      } else if (r.error === "sem_vagas") ui.agMsg = { ok: false, text: "A seleção passa das vagas livres da sessão." };
      else ui.agMsg = { ok: false, text: "Há entradas que não podem ser alocadas." };
      ui.agVersion = sessionOf(ui.agSessionId).version;
      ui.agSel = null;
      ui.agStale = false;
    },
    "ag-other": () => {
      const s = sessionOf(ui.agSessionId);
      const top = E.suggest(st, s.id)[0];
      if (top && E.allocate(st, s.id, [top.entry.id], { version: s.version }).ok) {
        ui.agStale = true; // a tela deste agendador continua com a lista antiga
        ui.events.add("other");
      }
    },
    "ref-accept": (d) => E.acceptReferral(st, d.id),
    "ref-reject": (d) => E.rejectReferral(st, d.id, document.getElementById(`reason-${d.id}`).value),
    "call-confirm": (d) => {
      E.confirmAllocation(st, d.id);
      ui.callMsg = {
        ok: true,
        text: `${esc(patient(byId(st.entries, d.id).patientId).name)}: confirmado pelo agendador.`,
      };
    },
    "call-refuse": (d) => {
      const r = E.refuseAllocation(st, d.id);
      const nm = patient(byId(st.entries, d.id).patientId).name;
      ui.callMsg = {
        ok: false,
        text: `${esc(nm)} recusou. A vaga foi liberada e ${esc(first(nm))} volta para a lista com a data original.${r.next ? ` Próximo sugerido: <b>${esc(patient(r.next.entry.patientId).name)}</b> (veja no Agendador).` : ""}`,
      };
      ui.events.add("refuse");
    },
    "call-none": (d) => {
      const e = byId(st.entries, d.id);
      e.calls = (e.calls || 0) + 1;
    },
    "desk-opt": (d) => {
      const a = ui.desk.answers;
      a[d.group] = E.toggleOption(a[d.group], d.id, "__none__");
    },
    "desk-submit": () => {
      const d = ui.desk;
      if (!d.name.trim() || !d.answers.motivo) {
        ui.deskResult = { ok: false, error: "campos" };
        return;
      }
      const r = E.frontDesk(st, openSession().id, { name: d.name.trim(), birth: d.birth, answers: d.answers });
      ui.deskResult = r.ok
        ? { ok: true, senha: r.item.senha, number: r.item.number, name: r.item.name, level: r.item.suggested }
        : { ok: false, error: r.error };
      if (r.ok) ui.desk = { name: "", birth: "1960-01-01", answers: emptyAnswers() };
    },
    "mark-present": (d) => E.markPresent(st, openSession().id, d.id),
    "tri-confirm": (d) => {
      const s = openSession();
      const q = byId(s.queue, d.id);
      E.confirmRisk(st, s.id, d.id, ui.triLevel[d.id] || q.confirmedLevel || q.suggested);
    },
    "open-session": (d) => {
      E.openSession(st, d.id);
      ui.agSel = null;
    },
    "station-toggle": (d) => {
      const x = byId(st.stations, d.id);
      const r = E.setStationOpen(st, d.id, !x.open);
      ui.stationAdminMsg = r.ok
        ? null
        : `${x.name} tem um paciente chamado: finalize ou marque “Não compareceu” antes de fechar.`;
    },
    "tv-pair": () => {
      const r = E.pairTv(st, ui.tvCode.trim());
      ui.tvMsg = r.ok ? null : "O código não confere com o que aparece na TV.";
      if (r.ok) ui.tvCode = "";
    },
    "tv-revoke": () => {
      E.revokeTv(st);
      ui.tvStarted = false;
      ui.tvCur = null;
      ui.tvPending = [];
      ui.tvShown = [];
    },
    "tv-start": () => {
      ui.tvStarted = true;
      for (const a of st.tv.announcements) ui.tvSeen.add(a.id);
      try {
        ui.audio = ui.audio || new (window.AudioContext || window.webkitAudioContext)();
        ui.audio.resume();
      } catch {
        ui.audio = null;
      }
    },
    "st-next": () => {
      const r = E.callNext(st, openSession().id, ui.stationId);
      ui.stationMsg = r.ok
        ? null
        : "Ninguém na sala para chamar. Só é chamado quem leu o QR ou foi marcado pela recepção.";
    },
    "st-recall": () => E.recall(st, openSession().id, ui.stationId),
    "st-finish": () => {
      E.finish(st, openSession().id, ui.stationId);
      ui.stationMsg = null;
    },
    "st-skip": () => E.skip(st, openSession().id, ui.stationId),
    "st-risk": () => {
      const s = openSession();
      const station = byId(st.stations, ui.stationId);
      const q = station.current && byId(s.queue, station.current);
      if (q) E.confirmRisk(st, s.id, q.id, ui.stLevel || q.confirmedLevel || q.suggested);
      ui.stLevel = null;
    },
    "ns-vis": (d) => {
      ui.newSession.visibility = d.id;
    },
    "session-create": () => {
      const ns = ui.newSession;
      const created = E.createSession(st, {
        serviceId: ns.serviceId,
        start: dayStart(ns.day),
        slots: Number(ns.slots),
        visibility: ns.visibility,
        professional: "Dra. Marta",
      });
      ui.nsMsg = created ? null : "Vagas precisa ser um número inteiro, a partir de 1.";
      if (created && created.visibility === "privada") {
        ui.agSessionId = created.id;
        ui.agSel = null;
        ui.agVersion = created.version;
      }
    },
    sim: () => {
      const s = openSession();
      if (!s) return;
      const pid = scenario().protagonist;
      const before = st.tv.announcements.length;
      const r = E.simulate(st, s.id, { protagonist: pid });
      // A TV não reprisa horas de chamadas: mostra a mais recente e as anteriores em "últimas chamadas".
      const all = E.tvView(st).announcements || [];
      for (const a of all) ui.tvSeen.add(a.id);
      ui.tvPending = [];
      if (ui.tvStarted && all.length > before) {
        ui.tvShown = all.slice(-6, -1).reverse();
        ui.tvCur = { a: all.at(-1), until: Date.now() + 10000 };
        beep();
      }
      const name = first(patient(pid).name);
      if (r.reason === "called" || r.reason === "busy") {
        const station = st.stations.find((x) => x.current && byId(s.queue, x.current)?.patientId === pid);
        if (station) ui.stationId = station.id;
      }
      ui.simMsg = {
        notified: `Chegou um aviso no celular da ${name}.`,
        called: `${name} foi chamada! Veja a TV e a estação.`,
        busy: `${name} está sendo atendida agora: finalize na estação.`,
        timeout: "Passaram 4 horas sem aviso novo.",
      }[r.reason];
    },
    "svc-triage": (d) => {
      const x = service(d.id);
      E.setServiceTriage(st, d.id, !x.requiresTriage);
    },
    "station-create": () => {
      const ns = ui.newStation;
      if (!ns.name.trim()) return;
      E.createStation(st, { name: ns.name.trim(), stage: ns.stage, services: ["cli"] });
      ui.newStation = { name: "", stage: "atendimento" };
    },
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== "INPUT") ev.preventDefault();
    if (el.dataset.act !== "sim") ui.simMsg = null;
    sfxInit();
    if (el.dataset.act === "lesson-start" || el.dataset.act === "lesson-show") sfx("tap");
    fn(el.dataset);
    update(true);
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    const c = el.dataset.change;
    if (c === "ag-session") {
      ui.agSessionId = el.value;
      ui.agSel = null;
      ui.agStale = false;
      ui.agVersion = sessionOf(el.value).version;
      ui.agMsg = null;
    } else if (c === "station") {
      ui.stationId = el.value;
      ui.stationMsg = null;
      ui.stLevel = null;
    } else if (c === "ns-svc") {
      ui.newSession.serviceId = el.value;
    } else if (c === "ns-day") {
      ui.newSession.day = Number(el.value);
    } else if (c === "st-level") {
      ui.stLevel = el.value;
    } else if (c === "st-stage") {
      ui.newStation.stage = el.value;
    } else if (c === "tri-level") {
      ui.triLevel[el.dataset.id] = el.value;
    } else if (el.dataset.bind === "motivo" || el.dataset.bind === "gravidade") {
      ui.desk.answers[el.dataset.bind] = el.value || null;
      if (el.dataset.bind === "motivo" && el.value !== "novo") ui.desk.answers.gravidade = null;
    } else return;
    el.blur();
    update(true);
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset.bind === "name" || el.dataset.bind === "birth") ui.desk[el.dataset.bind] = el.value;
    if (el.dataset.bindTv) ui.tvCode = el.value;
    if (el.dataset.bindNs) ui.newSession[el.dataset.bindNs] = el.value;
    if (el.dataset.bindSt) {
      ui.newStation.name = el.value;
      const btn = document.querySelector('[data-act="station-create"]');
      if (btn) btn.disabled = !el.value.trim();
    }
    applyHint();
  });

  setInterval(() => {
    E.advance(st, 1000);
    update(false);
  }, 1000);

  load(STORY);
})();
