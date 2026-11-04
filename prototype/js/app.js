// Simulador: cenários, celular do paciente, painel, estação e TV sobre o mesmo estado (engine.js).
(() => {
  const E = window.Engine;
  const { MIN, DAY } = E;
  const TZ = "America/Sao_Paulo";
  const BASE = Date.UTC(2026, 10, 12, 9, 55); // quinta, 12/11/2026, 06:55 em Brasília
  const at = (days, hh, mm = 0) => Date.UTC(2026, 10, 12 + days, hh + 3, mm);

  // ---------- Questionário v1 (fonte 7.3) ----------

  const NONE1 = "nenhum";
  const NONE = "nenhuma";
  const ALARMS = [
    ["falta_ar", "Falta de ar forte ou dificuldade para respirar"],
    ["dor_peito", "Dor ou aperto forte no peito"],
    ["desmaio", "Desmaio, confusão ou sonolência estranha"],
    ["avc", "Fraqueza, formigamento ou boca torta de repente"],
    ["sangramento", "Sangramento que não para"],
    ["convulsao", "Convulsão"],
    ["autolesao", "Pensamentos de tirar a própria vida ou de se machucar"],
  ];
  const MOTIVOS = [
    ["novo", "Problema novo ou que piorou"],
    ["acompanhamento", "Acompanhamento de doença que já tenho"],
    ["exame", "Exame, check-up ou rotina"],
    ["receita", "Renovar receita"],
  ];
  const GRAVIDADE = [
    ["leve", "Leve, faço as coisas normalmente"],
    ["moderado", "Moderado, atrapalha o dia"],
    ["forte", "Forte, não consigo fazer quase nada"],
  ];
  const CONDICOES = [
    ["diabetes", "Diabetes"],
    ["pressao", "Pressão alta"],
    ["coracao", "Doença do coração"],
    ["asma", "Asma, bronquite ou DPOC"],
    ["cancer", "Câncer em tratamento"],
    ["imuno", "Imunidade baixa (transplante, HIV, uso de corticoide)"],
  ];
  const GRUPOS = [
    ["gestante", "Gestante"],
    ["lactante", "Lactante"],
    ["colo", "Com criança de colo"],
    ["pcd", "Pessoa com deficiência"],
    ["tea", "TEA"],
    ["obesidade", "Obesidade"],
  ];
  const QUIZ = [
    {
      key: "alarms",
      q: "Você está com algum destes agora?",
      multi: true,
      opts: ALARMS,
      none: [NONE1, "Nenhum destes"],
    },
    { key: "motivo", q: "Por que você quer o atendimento?", opts: MOTIVOS },
    { key: "gravidade", q: "Como está esse problema?", opts: GRAVIDADE, only: (a) => a.motivo === "novo" },
    {
      key: "condicoes",
      q: "Você tem alguma destas condições?",
      multi: true,
      opts: CONDICOES,
      none: [NONE, "Nenhuma"],
    },
    { key: "grupos", q: "Alguma destas se aplica a você?", multi: true, opts: GRUPOS, none: [NONE, "Nenhuma"] },
  ];
  const LABEL = Object.fromEntries([...ALARMS, ...MOTIVOS, ...GRAVIDADE, ...CONDICOES, ...GRUPOS]);

  const emptyAnswers = (grupos = []) => ({ alarms: [], motivo: null, gravidade: null, condicoes: [], grupos });
  const ans = (over) => ({ ...emptyAnswers(), ...over });

  // ---------- Dados fictícios ----------

  const PATIENTS = [
    ["maria", "Maria Souza", "F", "1992-04-10", "(85) 98811-2034"],
    ["antonio", "Antônio Lima", "M", "1958-02-02", "(85) 98702-1180"],
    ["lucia", "Lúcia Ramos", "F", "1999-08-20", "(85) 99120-4471"],
    ["dora", "Dora Alves", "F", "1944-03-01", "(85) 98450-9921"],
    ["carlos", "Carlos Melo", "M", "1979-06-15", "(85) 99311-0012"],
    ["edu", "Eduardo Reis", "M", "1985-01-30", "(85) 98177-6650"],
    ["fatima", "Fátima Nunes", "F", "1970-09-09", "(85) 98845-3307"],
    ["gil", "Gilberto Costa", "M", "1990-12-01", "(85) 99602-7781"],
    ["helena", "Helena Prado", "F", "1996-05-05", "(85) 98133-4590"],
    ["ivo", "Ivo Santos", "M", "1975-03-03", "(85) 98999-1402"],
    ["ana", "Ana Ribeiro", "F", "1988-07-12", "(85) 98222-3110"],
    ["joao", "João Pereira", "M", "1983-11-02", "(85) 99877-0045"],
    ["bruno", "Bruno Dias", "M", "1991-02-17", "(85) 98654-2290"],
    ["rita", "Rita Gomes", "F", "1960-06-25", "(85) 98710-5532"],
    ["paulo", "Paulo Freitas", "M", "1972-10-08", "(85) 99230-6618"],
    ["sergio", "Sérgio Luz", "M", "1980-04-04", "(85) 98301-7744"],
  ].map(([id, name, sexo, birth, phone]) => ({ id, name, sexo, birth, phone }));

  function baseState(sessions) {
    return E.createState({
      now: BASE,
      units: [
        {
          id: "u1",
          name: "UBS Vila Nova",
          type: "UBS",
          address: "Rua das Acácias, 120",
          hours: "Seg a Sex · 7h às 17h",
          x: 105,
          y: 150,
        },
        {
          id: "u2",
          name: "Policlínica Centro",
          type: "Policlínica",
          address: "Av. Brasil, 1500",
          hours: "Seg a Sex · 7h às 19h",
          x: 238,
          y: 78,
        },
        {
          id: "u3",
          name: "UBS Jardim Esperança",
          type: "UBS",
          address: "Rua Sete, 45",
          hours: "Seg a Sex · 7h às 16h",
          x: 228,
          y: 206,
        },
      ],
      services: [
        { id: "cli", unitId: "u1", name: "Clínico geral", prefix: "C", requiresReferral: false },
        { id: "odo", unitId: "u1", name: "Odontologia", prefix: "O", requiresReferral: false },
        { id: "car", unitId: "u2", name: "Cardiologia", prefix: "K", requiresReferral: true },
        { id: "der", unitId: "u2", name: "Dermatologia", prefix: "D", requiresReferral: true },
        { id: "cli3", unitId: "u3", name: "Clínico geral", prefix: "G", requiresReferral: false },
      ],
      patients: PATIENTS.map((p) => ({ ...p, faltas: [] })),
      sessions,
      stations: [
        { id: "st1", name: "Consultório 3", services: ["cli"], open: true },
        { id: "st2", name: "Consultório 4", services: ["cli"], open: false },
      ],
    });
  }

  function seed(st, pid, serviceId, daysAgo, answers) {
    st.now = BASE - daysAgo * DAY;
    const r = E.createEntry(st, { patientId: pid, serviceId, answers, referralPhoto: "foto.jpg" });
    st.now = BASE;
    return r.entry;
  }

  function allocateNow(st, sessionId, entries, when = BASE) {
    st.now = when;
    E.allocate(
      st,
      sessionId,
      entries.map((e) => e.id),
      { version: st.sessions.find((s) => s.id === sessionId).version },
    );
    st.now = BASE;
  }

  const SCENARIOS = {
    lista: {
      title: "Lista de espera e risco",
      intro: "Paciente acha a unidade, responde o questionário e envia o encaminhamento.",
      personas: ["maria", "antonio", "lucia"],
      tab: "agendador",
      steps: [
        "No celular (<b>Maria</b>), toque na <b>UBS Vila Nova</b> no mapa: horário e sessões futuras, sem nenhum paciente.",
        "Toque em <b>Entrar na lista</b> de Clínico geral. Responda: nenhum sinal · problema novo · moderado. Resultado: <b>Atenção</b>.",
        "Tente entrar de novo em Clínico geral: o app recusa e mostra a entrada que já existe.",
        "Abra a <b>Policlínica Centro</b> e entre em Cardiologia: o app pede a foto do encaminhamento.",
        "No painel › <b>Agendador</b>, aceite ou rejeite o encaminhamento. O aviso chega no celular.",
        "Troque para <b>Antônio</b> e marque <b>Dor ou aperto forte no peito</b>: o app mostra Ligar 192 e não cria entrada.",
        "Troque para <b>Lúcia</b> e marque <b>Pensamentos de tirar a própria vida</b>: CVV 188 e SAMU 192 em destaque. Siga e veja o alerta no painel.",
      ],
      setup() {
        const st = baseState([
          {
            id: "s-cli",
            serviceId: "cli",
            start: at(5, 7),
            slots: 20,
            visibility: "privada",
            professional: "Dra. Marta",
          },
          {
            id: "s-odo",
            serviceId: "odo",
            start: at(6, 8),
            slots: 12,
            visibility: "pública",
            professional: "Dr. Caio",
          },
          {
            id: "s-car",
            serviceId: "car",
            start: at(7, 13),
            slots: 15,
            visibility: "privada",
            professional: "Dr. Leão",
          },
          {
            id: "s-der",
            serviceId: "der",
            start: at(12, 8),
            slots: 10,
            visibility: "privada",
            professional: "Dra. Sol",
          },
          {
            id: "s-cli3",
            serviceId: "cli3",
            start: at(4, 7),
            slots: 20,
            visibility: "privada",
            professional: "Dr. Rui",
          },
        ]);
        seed(st, "dora", "cli", 41, ans({ motivo: "exame" }));
        seed(st, "gil", "cli", 60, ans({ motivo: "receita" }));
        allocateNow(st, "s-cli", [seed(st, "ivo", "cli", 30, ans({ motivo: "exame" }))]);
        return st;
      },
    },
    alocacao: {
      title: "Alocação e confirmação",
      intro: "Agendador preenche as vagas de uma sessão privada e acompanha quem não confirmou.",
      personas: ["helena", "carlos", "edu", "dora", "ivo"],
      tab: "agendador",
      steps: [
        "Painel › <b>Agendador</b>: a sugestão vem ordenada, com motivos. Veja o alerta de faltas da <b>Fátima</b> e onde ficou a <b>Dora</b>, 82 anos.",
        "Deixe as 3 vagas sugeridas marcadas e clique <b>Alocar</b>. Cada um recebe “confirme em 24 h”.",
        "No celular (<b>Helena</b>), abra a alocação e toque em <b>Confirmar</b>.",
        "Painel › <b>Lista de ligação</b>: <b>Ivo</b> está destacado (mais de 24 h sem resposta). Registre <b>Recusou</b> em alguém: a vaga volta e o próximo é sugerido.",
        "No Agendador, clique <b>Simular outro agendador</b> e depois tente alocar: erro e lista atualizada.",
        "Use <b>+1 dia</b> no relógio: as alocações sem resposta ficam destacadas.",
      ],
      setup() {
        const st = baseState([
          {
            id: "s-aloc",
            serviceId: "cli",
            start: at(1, 7),
            slots: 4,
            visibility: "privada",
            professional: "Dra. Marta",
          },
          {
            id: "s-cli",
            serviceId: "cli",
            start: at(6, 7),
            slots: 20,
            visibility: "privada",
            professional: "Dra. Marta",
          },
        ]);
        const ivo = seed(st, "ivo", "cli", 30, ans({ motivo: "exame" }));
        allocateNow(st, "s-aloc", [ivo], BASE - 25 * 60 * MIN);
        seed(st, "dora", "cli", 41, ans({ motivo: "exame" }));
        seed(st, "carlos", "cli", 3, ans({ motivo: "novo", gravidade: "forte" }));
        seed(st, "edu", "cli", 15, ans({ motivo: "exame" })).remanejado = true;
        seed(st, "fatima", "cli", 20, ans({ motivo: "novo", gravidade: "leve", condicoes: ["diabetes"] }));
        st.patients.find((p) => p.id === "fatima").faltas = [BASE - 10 * DAY, BASE - 50 * DAY];
        seed(st, "gil", "cli", 60, ans({ motivo: "receita" }));
        seed(st, "helena", "cli", 8, ans({ motivo: "novo", gravidade: "leve", grupos: ["gestante"] }));
        return st;
      },
    },
    fila: {
      title: "Fila do dia",
      intro: "Sessão de hoje: fila remota, check-in pelo QR, janela protegida, chamada, pulos e balcão.",
      personas: ["joao", "ana", "bruno", "paulo", "dora", "sergio"],
      tab: "admin",
      steps: [
        "Painel › <b>Admin</b>: digite o código da TV e clique <b>Parear</b>. Na TV, toque <b>Iniciar painel</b> (libera o som).",
        "Clique <b>Abrir sessão</b>: os confirmados entram remotos com senha. A alocação pendente do <b>Sérgio</b> é liberada.",
        "No celular, veja posição e tempo de cada um. Feche o <b>Consultório 3</b> no Admin para ver “aguardando início do atendimento”.",
        "Como <b>João</b>, toque <b>Cheguei: ler QR</b>. Depois como <b>Ana</b> (posição melhor). Chame o próximo: João vem antes (RN-ORD-01).",
        "Recomece o cenário. João e Ana leem o QR, depois <b>Bruno</b>: ordem João, Bruno, Ana (RN-ORD-03). Se Ana já foi chamada, Bruno vai para o fim (RN-ORD-04).",
        "Painel › <b>Triagem</b>: confirme <b>Paulo</b> (remoto) como Urgente. Ele recebe “venha agora” e, ao chegar, é o próximo.",
        "Chame alguém e use <b>+5 min</b>: ele é pulado. No 2º pulo volta para remoto; no 3º sai da fila.",
        "Painel › <b>Recepção</b>: inclua um paciente no balcão. Ele entra presente e recebe a senha.",
        "No celular, toque <b>Usar foto antiga do QR</b>: o check-in é recusado.",
      ],
      setup() {
        const st = baseState([
          {
            id: "s-hoje",
            serviceId: "cli",
            start: at(0, 7),
            slots: 12,
            visibility: "privada",
            professional: "Dra. Marta",
          },
        ]);
        const confirmed = [
          seed(st, "bruno", "cli", 40, ans({ motivo: "exame" })),
          seed(st, "ana", "cli", 30, ans({ motivo: "acompanhamento" })),
          seed(st, "joao", "cli", 20, ans({ motivo: "exame" })),
          seed(st, "dora", "cli", 15, ans({ motivo: "exame" })),
          seed(st, "rita", "cli", 10, ans({ motivo: "receita" })),
          seed(st, "paulo", "cli", 5, ans({ motivo: "novo", gravidade: "leve" })),
        ];
        allocateNow(st, "s-hoje", confirmed, BASE - 3 * DAY);
        for (const e of confirmed) E.confirmAllocation(st, e.id);
        allocateNow(st, "s-hoje", [seed(st, "sergio", "cli", 3, ans({ motivo: "exame" }))], BASE - 2 * 60 * MIN);
        return st;
      },
    },
  };

  // ---------- Estado ----------

  let st;
  let ui;

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
      toasted: new Set(st.notifications.map((n) => n.id)),
      read: new Set(),
      tab: sc.tab,
      agSessionId: st.sessions.find((s) => s.visibility === "privada" && s.state === "planejada")?.id,
      agSel: null,
      agVersion: null,
      agMsg: null,
      callMsg: null,
      desk: { name: "", birth: "1960-01-01", answers: emptyAnswers() },
      deskResult: null,
      triLevel: {},
      tvCode: "",
      tvMsg: null,
      tvStarted: false,
      tvCur: null,
      tvPending: [],
      tvSeen: new Set(),
      tvShown: [],
      stationId: "st1",
      stationMsg: null,
    };
    for (const id of Object.keys(regions)) regions[id]._html = null;
    update(true);
  }

  // ---------- Utilidades ----------

  const fmt = (o) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit" });
  const fDate = fmt({ day: "2-digit", month: "2-digit" });
  const fClock = fmt({
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const byId = (list, id) => list.find((x) => x.id === id);
  const patient = (id) => byId(st.patients, id);
  const service = (id) => byId(st.services, id);
  const sessionOf = (id) => byId(st.sessions, id);
  const first = (name) => name.split(" ")[0];
  const age = (p) => E.ageAt(p.birth, st.now);
  const openSession = () => st.sessions.find((s) => s.state === "aberta");
  const ago = (t) => {
    const m = Math.floor((st.now - t) / MIN);
    if (m < 60) return `${m} min`;
    if (m < 60 * 24) return `${Math.floor(m / 60)} h`;
    return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
  };

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

  function answersText(a) {
    const list = (arr, none) =>
      arr
        .filter((x) => x !== none)
        .map((x) => LABEL[x])
        .join(", ") || "nenhuma";
    return [
      `Sinais: ${list(a.alarms, NONE1)}`,
      `Motivo: ${LABEL[a.motivo] || "—"}${a.gravidade ? ` (${LABEL[a.gravidade].split(",")[0].toLowerCase()})` : ""}`,
      `Condições: ${list(a.condicoes, NONE)}`,
      `Grupos: ${list(a.grupos, NONE)}`,
    ].join("<br>");
  }

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
      // sem som: a demo continua
    }
  }

  // QR ilustrativo: o desenho muda junto com o token.
  function qrSvg(token) {
    let h = 2166136261;
    const n = 21;
    let cells = "";
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let on;
        if (finder(x, y)) {
          const fx = x >= n - 7 ? x - (n - 7) : x;
          const fy = y >= n - 7 ? y - (n - 7) : y;
          on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
        } else {
          h ^= token.charCodeAt((x * 7 + y * 13) % token.length) + x * 31 + y;
          h = Math.imul(h, 16777619) >>> 0;
          on = (h & 7) < 3;
        }
        if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
    return `<svg viewBox="0 0 ${n} ${n}" fill="#0b1716" aria-label="QR de entrada">${cells}</svg>`;
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
        ${back ? `<button class="back" data-act="go" data-screen="${back}" aria-label="Voltar">←</button>` : ""}
        <h3>${title}</h3>
        <button class="bell" data-act="go" data-screen="inbox" aria-label="Notificações">🔔${unread ? `<span class="dot">${unread}</span>` : ""}</button>
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
        const today =
          q && ["fila", "chamado"].includes(q.status)
            ? `<button class="card tap today" data-act="go" data-screen="queue">
                <div class="row between"><span class="muted">Fila de hoje · ${esc(service(sessionOf(q.sessionId).serviceId).name)}</span><span class="chip ok">${q.presence === "presente" ? "na unidade" : "remoto"}</span></div>
                <div class="big">${q.senha}</div>
                <div>${q.status === "chamado" ? "É a sua vez!" : etaText(q.eta)}</div>
              </button>`
            : "";
        const entries = v.entries.filter((e) => !["cancelada"].includes(e.status));
        body = `
          ${today}
          <div class="map">${mapSvg()}</div>
          <div class="section-title">Minhas solicitações</div>
          ${
            entries.length
              ? entries
                  .map(
                    (e) => `<button class="card tap" data-act="entry" data-id="${e.id}">
                      <div class="row between"><strong>${esc(service(e.serviceId).name)}</strong>${statusChip(e.status)}</div>
                      <div class="muted">${esc(byId(st.units, service(e.serviceId).unitId).name)} · desde ${fDate.format(e.createdAt)}</div>
                    </button>`,
                  )
                  .join("")
              : `<p class="muted">Nenhuma ainda. Toque numa unidade no mapa.</p>`
          }`;
        break;
      }
      case "unit": {
        const unit = byId(st.units, ui.unitId);
        const agenda = E.unitAgenda(st, ui.unitId);
        title = esc(unit.name);
        body = `
          <div class="row"><span class="chip">${unit.type}</span><span class="muted">${esc(unit.address)}</span></div>
          <div class="section-title">Horário</div>
          <div>${agenda.hours}</div>
          <div class="section-title">Próximas sessões</div>
          ${agenda.sessions.map((s) => `<div class="card">${esc(s.text)}</div>`).join("") || `<p class="muted">Sem sessões futuras.</p>`}
          <div class="section-title">Serviços</div>
          ${st.services
            .filter((s) => s.unitId === unit.id)
            .map(
              (s) => `<div class="card row between">
                <div><strong>${esc(s.name)}</strong>${s.requiresReferral ? `<div class="muted">exige encaminhamento</div>` : ""}</div>
                <button class="btn sm" data-act="join" data-id="${s.id}">Entrar na lista</button>
              </div>`,
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
            <p class="muted">Fotografe a requisição do médico. O agendador confere se é para este serviço e se está na validade.</p>
            <div class="viewfinder">${qz.photo ? "✓ Foto pronta: requisicao.jpg" : "Aponte para a requisição"}</div>
            <button class="btn ghost block" data-act="photo">${qz.photo ? "Tirar outra" : "Tirar foto"}</button>`;
          foot = `<button class="btn block" data-act="quiz-next" ${qz.photo ? "" : "disabled"}>Enviar</button>`;
        } else {
          const val = qz.answers[stepDef.key];
          const pressed = (id) => (stepDef.multi ? val.includes(id) : val === id);
          const opts = [...stepDef.opts, ...(stepDef.none ? [stepDef.none] : [])];
          body = `
            <div class="quiz-progress"><span style="width:${pct}%"></span></div>
            <p class="quiz-q">${stepDef.q}</p>
            <p class="muted">${stepDef.multi ? "Marque todas que se aplicam" : "Escolha uma"}</p>
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
        title = "";
        if (r.kind === "emergencia") {
          back = "home";
          body = `<div class="emergency">
            <div class="result"><div class="icon" style="background:#fff;color:var(--red)">!</div></div>
            <h4>Procure atendimento agora</h4>
            <p>O que você marcou pode ser uma emergência. Não espere na fila: ligue para o SAMU ou vá à emergência mais próxima.</p>
            <a class="call-btn" href="tel:192">Ligar 192 · SAMU</a>
            <p style="font-size:12px;opacity:.85">Você não entrou na lista de espera.</p>
            <button class="btn ghost block" style="color:#fff;border-color:#fff;margin-top:18px" data-act="go" data-screen="home">Voltar ao início</button>
          </div>`;
        } else if (r.kind === "support") {
          back = "unit";
          body = `<div class="result">
            <div class="icon" style="background:var(--violet-2);color:var(--violet)">♥</div>
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
            <div class="icon" style="background:var(--sun-2);color:#9a5a06">=</div>
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
            <div class="icon" style="background:var(--green-2);color:var(--green)">✓</div>
            <h4>Você entrou na lista</h4>
            <p>${esc(service(e.serviceId).name)} · ${esc(byId(st.units, service(e.serviceId).unitId).name)}</p>
            <p>${levelChip(e.suggested, false)}</p>
            <p class="muted">A classificação é uma sugestão. A equipe da unidade confirma.${
              e.status === "aguardando_encaminhamento" ? " Seu encaminhamento será conferido pelo agendador." : ""
            } Você recebe um aviso quando houver vaga.</p>
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
          action = `<div class="card" style="border-color:var(--violet)">
            <strong>Você tem uma vaga</strong>
            <p>${E.dayLabel(s.start)} · ${fTime.format(s.start)} · ${esc(byId(st.units, service(s.serviceId).unitId).name)}</p>
            <p class="muted">Confirme até ${E.dayLabel(e.deadline)}, ${fTime.format(e.deadline)}.</p>
            <div class="row"><button class="btn" data-act="confirm-alloc" data-id="${e.id}">Confirmar</button>
            <button class="btn ghost" data-act="refuse-alloc" data-id="${e.id}">Não vou poder ir</button></div>
          </div>`;
        if (e.status === "confirmada")
          action = `<div class="banner ok">Confirmado para ${E.dayLabel(s.start)}, ${fTime.format(s.start)}. Quando a sessão abrir, você entra na fila remota e acompanha daqui.</div>`;
        if (e.status === "na_fila")
          action = `<button class="btn block" data-act="go" data-screen="queue">Ver minha fila</button>`;
        if (e.referral?.status === "rejeitado")
          action = `<div class="banner error">Encaminhamento rejeitado: ${esc(e.referral.reason)}</div>`;
        body = `
          <div class="row between"><span>${statusChip(e.status)}</span>${levelChip(e.confirmedLevel || e.suggested, !!e.confirmedLevel)}</div>
          <div class="section-title">Detalhes</div>
          <div class="card">
            <div>${esc(byId(st.units, service(e.serviceId).unitId).name)}</div>
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
        if (q.status === "chamado") {
          body = `<div class="ticket called"><div>É a sua vez!</div><div class="senha">${q.senha}</div><div class="pos">${esc(svc.name)} → ${esc(q.station)}</div></div>
          <p class="muted">Dirija-se à sala agora. Você tem ${st.config.toleranceMin} minutos.</p>`;
        } else if (q.status === "atendido") {
          body = `<div class="ticket"><div class="senha">${q.senha}</div><div class="pos">Atendimento concluído</div></div>`;
        } else if (q.status === "saiu") {
          body = `<div class="banner error">Você saiu da fila por não comparecer à chamada 3 vezes. Para outro dia, entre de novo na lista de espera.</div>`;
        } else {
          body = `
            <div class="ticket">
              <div class="muted">${esc(svc.name)}</div>
              <div class="senha">${q.senha}</div>
              <div class="pos">${etaText(q.eta)}</div>
              <div class="presence"><span class="chip ${q.presence === "presente" ? "ok" : ""}">${q.presence === "presente" ? "Você está na unidade" : "Você está remoto"}</span>${q.skips ? `<span class="chip urgente">${q.skips} pulo${q.skips > 1 ? "s" : ""}</span>` : ""}</div>
            </div>
            ${ui.qrMsg ? `<div class="banner ${ui.qrMsg.ok ? "ok" : "error"}">${ui.qrMsg.text}</div>` : ""}
            <p class="muted">${
              q.presence === "presente"
                ? "Fique na sala de espera. Sua senha aparece na TV quando for a sua vez. Se precisar sair, toque em “Vou sair”: você mantém o número."
                : `Espere em casa. Você recebe “saia de casa” quando faltar cerca de ${st.config.leaveHomeMin} min. Só é chamado quem leu o QR na unidade.`
            }</p>`;
          foot =
            q.presence === "remoto"
              ? `<button class="btn block" data-act="sheet" data-id="qr">Cheguei: ler QR da TV</button>`
              : `<button class="btn ghost block" data-act="leave">Vou sair</button>`;
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
            <div class="viewfinder">Aponte para o QR na TV da sala de espera</div>
            <button class="btn block" data-act="scan">Ler QR da TV</button>
            <p></p>
            <button class="btn ghost block sm" data-act="scan-old">Usar foto antiga do QR (teste)</button>
          </div>`
        : "";

    return `<div class="screen">
      <div class="statusbar"><span>${fTime.format(st.now)}</span><span>●●● 4G</span></div>
      ${toast}
      ${ui.screen === "result" && ui.result.kind === "emergencia" ? "" : head(title, back)}
      <div class="app-body">${body}</div>
      ${foot ? `<div class="app-foot">${foot}</div>` : ""}
      ${sheet}
    </div>`;
  }

  function etaText(eta) {
    if (!eta) return "";
    if (eta.minutes === null) return `você é o ${eta.position}º · aguardando início do atendimento`;
    if (eta.position === 1) return "você é o próximo";
    return `você é o ${eta.position}º · ~${eta.minutes} min`;
  }

  function mapSvg() {
    const pins = st.units
      .map(
        (u) => `<g class="pin" data-act="unit" data-id="${u.id}" transform="translate(${u.x} ${u.y})">
          <path d="M0 0c-8-10-12-15-12-21a12 12 0 0 1 24 0c0 6-4 11-12 21z" fill="${u.type === "UBS" ? "#0f6e66" : "#5b4fb0"}"/>
          <circle cy="-21" r="4.5" fill="#fff"/>
          <text y="12" text-anchor="middle" font-size="9" font-weight="700" fill="#12302f">${esc(u.name)}</text>
        </g>`,
      )
      .join("");
    return `<svg viewBox="0 0 320 240" role="img" aria-label="Mapa de unidades">
      <rect width="320" height="240" fill="#e9efe6"/>
      <path d="M-10 120 Q80 100 160 130 T330 110" stroke="#fff" stroke-width="14" fill="none"/>
      <path d="M150 -10 L170 250" stroke="#fff" stroke-width="10" fill="none"/>
      <path d="M-10 40 L330 70" stroke="#fff" stroke-width="7" fill="none"/>
      <path d="M40 250 L90 -10" stroke="#fff" stroke-width="6" fill="none"/>
      <rect x="20" y="170" width="60" height="45" rx="8" fill="#d3e4cf"/>
      <rect x="260" y="140" width="48" height="40" rx="8" fill="#d3e4cf"/>
      <path d="M200 -10 Q230 40 330 30 L330 -10z" fill="#cfe1ea"/>
      <circle cx="165" cy="160" r="22" fill="#0f6e66" opacity=".12"/>
      <circle cx="165" cy="160" r="6" fill="#2b7de9" stroke="#fff" stroke-width="2.5"/>
      ${pins}
    </svg>`;
  }

  function quizSteps(qz) {
    const steps = QUIZ.filter((s) => !s.only || s.only(qz.answers));
    return service(qz.serviceId).requiresReferral ? [...steps, "foto"] : steps;
  }

  // ---------- Painel ----------

  const TABS = [
    ["agendador", "Agendador"],
    ["ligacao", "Lista de ligação"],
    ["recepcao", "Recepção"],
    ["triagem", "Triagem"],
    ["admin", "Admin da unidade"],
  ];

  function adminHTML() {
    const pendingRef = st.entries.filter((e) => e.referral?.status === "pendente").length;
    const overdue = E.callList(st).filter((c) => c.overdue).length;
    const counts = { agendador: pendingRef + st.alerts.length, ligacao: overdue };
    const tabs = `<div class="tabs" role="tablist">${TABS.map(
      ([id, label]) =>
        `<button role="tab" aria-selected="${ui.tab === id}" data-act="tab" data-id="${id}">${label}${counts[id] ? `<span class="count">${counts[id]}</span>` : ""}</button>`,
    ).join("")}</div>`;
    const body = {
      agendador: agendadorHTML,
      ligacao: ligacaoHTML,
      recepcao: recepcaoHTML,
      triagem: triagemHTML,
      admin: unitAdminHTML,
    }[ui.tab]();
    return `${tabs}<div class="admin-body">${body}</div>`;
  }

  function agendadorHTML() {
    const alerts = st.alerts.map((a) => `<div class="banner error">⚠ ${esc(a.text)}</div>`).join("");
    const refs = st.entries.filter((e) => e.referral?.status === "pendente");
    const refsHTML = refs.length
      ? `<h4>Encaminhamentos para validar</h4>
        <table><tr><th>Paciente</th><th>Serviço</th><th>Foto</th><th></th></tr>
        ${refs
          .map((e) => {
            const p = patient(e.patientId);
            return `<tr><td>${esc(p.name)}<div class="reasons">${age(p)} anos</div></td><td>${esc(service(e.serviceId).name)}</td>
              <td><span class="chip">📄 requisicao.jpg</span></td>
              <td><div class="row"><button class="btn sm" data-act="ref-accept" data-id="${e.id}">Aceitar</button>
              <select id="reason-${e.id}"><option>Ilegível</option><option>Não é para este serviço</option><option>Fora da validade</option></select>
              <button class="btn sm danger" data-act="ref-reject" data-id="${e.id}">Rejeitar</button></div></td></tr>`;
          })
          .join("")}</table>`
      : "";

    const sessions = st.sessions.filter((s) => s.visibility === "privada" && s.state === "planejada");
    if (!sessions.length)
      return `${alerts}${refsHTML}<h4>Alocação</h4><p class="muted">Nenhuma sessão privada planejada.</p>`;
    const s = sessionOf(ui.agSessionId) || sessions[0];
    ui.agSessionId = s.id;
    if (ui.agVersion === null) ui.agVersion = s.version;
    const sug = E.suggest(st, s.id);
    const free = s.slots - E.occupied(st, s.id);
    const key = `${s.id}:${sug.map((x) => x.entry.id).join(",")}`;
    if (ui.agSel === null || ui.agKey !== key) {
      ui.agSel = new Set(sug.slice(0, Math.max(0, free)).map((x) => x.entry.id));
      ui.agKey = key;
    }
    const rows = sug
      .map((x, i) => {
        const e = x.entry;
        const p = patient(e.patientId);
        return `<tr class="${ui.agSel.has(e.id) ? "" : "off"}">
          <td><input type="checkbox" data-act="ag-toggle" data-id="${e.id}" ${ui.agSel.has(e.id) ? "checked" : ""} aria-label="Selecionar ${esc(p.name)}"></td>
          <td class="mono">${i + 1}</td>
          <td><strong>${esc(p.name)}</strong>, ${age(p)}
            <div class="reasons">${x.reasons.map(esc).join(" · ")}</div>
            ${x.faltaAlert ? `<div class="alert-falta">⚠ ${p.faltas.length} faltas nos últimos 90 dias</div>` : ""}
            <details><summary class="reasons">respostas · regra: ${esc(e.rule)}</summary><div class="answers">${answersText(e.answers)}</div></details>
          </td>
          <td>${levelChip(e.confirmedLevel || e.suggested, !!e.confirmedLevel)}</td>
        </tr>`;
      })
      .join("");
    return `${alerts}${refsHTML}
      <h4>Alocação · sessão privada</h4>
      <div class="row between">
        <select data-change="ag-session">${sessions
          .map(
            (x) =>
              `<option value="${x.id}" ${x.id === s.id ? "selected" : ""}>${esc(service(x.serviceId).name)} · ${E.dayLabel(x.start)} ${fTime.format(x.start)}</option>`,
          )
          .join("")}</select>
        <span class="chip ${free ? "ok" : "urgente"}">${E.occupied(st, s.id)} de ${s.slots} vagas ocupadas · ${free} livre${free === 1 ? "" : "s"}</span>
      </div>
      <p class="who">Sugestão do sistema: urgência confirmada → remanejados → risco → prioridade legal → data de entrada. Você decide: nada é alocado sozinho.</p>
      ${ui.agMsg ? `<div class="banner ${ui.agMsg.ok ? "ok" : "error"}">${ui.agMsg.text}</div>` : ""}
      ${sug.length ? `<table><tr><th></th><th>#</th><th>Paciente e motivos</th><th>Nível</th></tr>${rows}</table>` : `<p class="muted">Ninguém aguardando neste serviço.</p>`}
      <p></p>
      <div class="row">
        <button class="btn" data-act="ag-alloc" ${ui.agSel.size ? "" : "disabled"}>Alocar ${ui.agSel.size} selecionado${ui.agSel.size === 1 ? "" : "s"}</button>
        <button class="btn ghost" data-act="ag-other" ${sug.length ? "" : "disabled"}>Simular outro agendador</button>
      </div>`;
  }

  function ligacaoHTML() {
    const list = E.callList(st);
    return `<h3>Lista de ligação</h3>
      <p class="who">Alocações sem confirmação, pela sessão mais próxima. Destacadas depois de 24 h. Ligue e registre o resultado.</p>
      ${ui.callMsg ? `<div class="banner ${ui.callMsg.ok ? "ok" : ""}">${ui.callMsg.text}</div>` : ""}
      ${
        list.length
          ? `<table><tr><th>Paciente</th><th>Sessão</th><th>Alocado há</th><th></th></tr>
          ${list
            .map(({ entry: e, overdue }) => {
              const p = patient(e.patientId);
              const s = sessionOf(e.sessionId);
              return `<tr class="${overdue ? "hl" : ""}"><td><strong>${esc(p.name)}</strong><div class="reasons">📞 ${p.phone}</div>${e.calls ? `<div class="reasons">${e.calls}× sem contato</div>` : ""}</td>
                <td>${esc(service(s.serviceId).name)}<div class="reasons">${E.dayLabel(s.start)} ${fTime.format(s.start)}</div></td>
                <td>${ago(e.allocatedAt)}${overdue ? `<div class="alert-falta">mais de 24 h</div>` : ""}</td>
                <td><div class="stack"><button class="btn sm" data-act="call-confirm" data-id="${e.id}">Confirmado</button>
                <button class="btn sm danger" data-act="call-refuse" data-id="${e.id}">Recusou</button>
                <button class="btn sm ghost" data-act="call-none" data-id="${e.id}">Sem contato</button></div></td></tr>`;
            })
            .join("")}</table>`
          : `<p class="muted">Ninguém pendente.</p>`
      }`;
  }

  function queueTable(s, withAction) {
    const rows = [...s.queue]
      .sort((a, b) => a.number - b.number)
      .map((q) => {
        const sit = {
          fila: q.presence === "presente" ? "aguardando" : "a caminho",
          chamado: "chamado",
          atendido: "atendido",
          saiu: "saiu",
        }[q.status];
        return `<tr class="${q.status === "atendido" || q.status === "saiu" ? "off" : ""}">
          <td class="mono">${q.senha}</td><td>${esc(q.name)}${q.origin === "balcao" ? ` <span class="chip">balcão</span>` : ""}</td><td class="mono">${q.number}</td>
          <td><span class="chip ${q.presence === "presente" ? "ok" : ""}">${q.presence}</span></td><td>${sit}${q.skips ? ` · ${q.skips} pulo(s)` : ""}</td>
          <td>${withAction(q)}</td></tr>`;
      })
      .join("");
    return `<table><tr><th>Senha</th><th>Paciente</th><th>Nº</th><th>Presença</th><th>Situação</th><th></th></tr>${rows}</table>`;
  }

  function checkbox(group, id, label, list) {
    return `<label><input type="checkbox" data-act="desk-opt" data-group="${group}" data-id="${id}" ${list.includes(id) ? "checked" : ""}>${label}</label>`;
  }

  function recepcaoHTML() {
    const s = openSession();
    if (!s)
      return `<h3>Recepção</h3><p class="muted">Nenhuma sessão aberta hoje. Abra a sessão em Admin da unidade para usar o balcão.</p>`;
    const d = ui.desk;
    const a = d.answers;
    const r = ui.deskResult;
    const result = !r
      ? ""
      : r.ok
        ? `<div class="desk-ticket"><div class="muted">Anote ou imprima para o paciente</div><div class="senha">${r.senha}</div><div>${esc(r.name)} · presente · nº ${r.number} · ${levelChip(r.level, false)}</div></div>`
        : r.error === "emergencia"
          ? `<div class="banner error"><strong>Emergência.</strong> Não inclua na fila: encaminhe o paciente à emergência agora (SAMU 192).</div>`
          : r.error === "sem_vagas"
            ? `<div class="banner error">Sessão sem vagas. Ninguém pode passar do limite.</div>`
            : `<div class="banner error">Preencha nome e responda motivo.</div>`;
    return `<h3>Balcão · ${esc(service(s.serviceId).name)} hoje</h3>
      <p class="who">Para quem não tem app. O paciente entra presente, com o próximo número. ${E.occupied(st, s.id)} de ${s.slots} vagas ocupadas.</p>
      <div class="grid2">
        <div class="field"><label for="desk-name">Nome</label><input id="desk-name" data-bind="name" value="${esc(d.name)}" placeholder="Nome completo"></div>
        <div class="field"><label for="desk-birth">Nascimento</label><input id="desk-birth" type="date" data-bind="birth" value="${esc(d.birth)}"></div>
      </div>
      <div class="field"><label>Sinais agora</label><div class="checks">${ALARMS.map(([id, l]) => checkbox("alarms", id, l, a.alarms)).join("")}</div></div>
      <div class="grid2">
        <div class="field"><label for="desk-motivo">Motivo</label><select id="desk-motivo" data-bind="motivo"><option value="">—</option>${MOTIVOS.map(([id, l]) => `<option value="${id}" ${a.motivo === id ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label for="desk-grav">Como está</label><select id="desk-grav" data-bind="gravidade" ${a.motivo === "novo" ? "" : "disabled"}><option value="">—</option>${GRAVIDADE.map(([id, l]) => `<option value="${id}" ${a.gravidade === id ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Condições</label><div class="checks">${CONDICOES.map(([id, l]) => checkbox("condicoes", id, l, a.condicoes)).join("")}</div></div>
      <div class="field"><label>Prioridade legal</label><div class="checks">${GRUPOS.map(([id, l]) => checkbox("grupos", id, l, a.grupos)).join("")}</div></div>
      <button class="btn" data-act="desk-submit">Incluir no balcão</button>
      ${result}
      <h4>Fila de hoje</h4>
      ${queueTable(s, (q) =>
        q.status === "fila" && q.presence === "remoto" && q.patientId
          ? `<button class="btn sm soft" data-act="mark-present" data-id="${q.patientId}">Marcar presença</button>`
          : "",
      )}`;
  }

  function triagemHTML() {
    const s = openSession();
    if (!s) return `<h3>Triagem</h3><p class="muted">Nenhuma sessão aberta hoje.</p>`;
    return `<h3>Triagem · confirmar classificação</h3>
      <p class="who">A triagem tem a palavra final sobre o risco. Urgência confirmada passa na frente; se o paciente estiver remoto, ele recebe “venha agora”. (No protótipo, a triagem não tem fila própria.)</p>
      ${queueTable(s, (q) => {
        if (!["fila", "chamado"].includes(q.status)) return "";
        const cur = ui.triLevel[q.id] || q.confirmedLevel || q.suggested;
        return `<div class="row">${levelChip(q.confirmedLevel || q.suggested, !!q.confirmedLevel)}
          <select data-change="tri-level" data-id="${q.id}">${["urgente", "atencao", "rotina"].map((l) => `<option value="${l}" ${l === cur ? "selected" : ""}>${E.RISK_LABEL[l]}</option>`).join("")}</select>
          <button class="btn sm" data-act="tri-confirm" data-id="${q.id}">Confirmar</button></div>`;
      })}`;
  }

  function unitAdminHTML() {
    const sessions = st.sessions.filter((s) => service(s.serviceId).unitId === "u1");
    const tv = st.tv;
    return `<h3>UBS Vila Nova</h3>
      <h4>Sessões</h4>
      <table><tr><th>Serviço</th><th>Quando</th><th>Vagas</th><th>Estado</th><th></th></tr>
      ${sessions
        .map(
          (
            s,
          ) => `<tr><td>${esc(service(s.serviceId).name)}<div class="reasons">${s.visibility} · ${esc(s.professional || "")}</div></td>
          <td>${E.dayLabel(s.start)} ${fTime.format(s.start)}</td><td>${E.occupied(st, s.id)}/${s.slots}</td>
          <td><span class="chip ${s.state === "aberta" ? "ok" : ""}">${s.state}</span></td>
          <td>${s.state === "planejada" ? `<button class="btn sm" data-act="open-session" data-id="${s.id}">Abrir sessão</button>` : ""}</td></tr>`,
        )
        .join("")}</table>
      <h4>Estações</h4>
      <table>${st.stations
        .map(
          (
            x,
          ) => `<tr><td><strong>${esc(x.name)}</strong><div class="reasons">atendimento · ${x.services.map((id) => esc(service(id).name)).join(", ")}</div></td>
          <td><span class="chip ${x.open ? "ok" : ""}">${x.open ? "aberta · profissional logado" : "fechada"}</span></td>
          <td><button class="btn sm ghost" data-act="station-toggle" data-id="${x.id}">${x.open ? "Fechar" : "Abrir"}</button></td></tr>`,
        )
        .join("")}</table>
      <h4>TV da sala de espera</h4>
      ${
        tv.paired
          ? `<div class="row between"><span class="chip ok">● online · pareada</span><button class="btn sm danger" data-act="tv-revoke">Revogar</button></div>`
          : `<p class="who">Abra <code>/tv</code> na TV e digite o código de 6 dígitos que aparece nela.</p>
            <div class="row"><input data-bind-tv="code" value="${esc(ui.tvCode)}" placeholder="000000" maxlength="6" inputmode="numeric" aria-label="Código da TV" style="width:120px;border:1px solid var(--line);border-radius:8px;padding:7px 9px">
            <button class="btn sm" data-act="tv-pair">Parear</button></div>`
      }
      ${ui.tvMsg ? `<div class="banner error" style="margin-top:8px">${ui.tvMsg}</div>` : ""}`;
  }

  // ---------- Estação ----------

  function stationHTML() {
    const station = byId(st.stations, ui.stationId);
    const s = openSession();
    const select = `<div class="row between"><select data-change="station" aria-label="Estação">${st.stations
      .map((x) => `<option value="${x.id}" ${x.id === station.id ? "selected" : ""}>${esc(x.name)}</option>`)
      .join(
        "",
      )}</select><span class="chip ${station.open ? "ok" : ""}">${station.open ? "aberta" : "fechada"}</span></div>`;
    if (!s)
      return `${select}<p class="muted">Nenhuma sessão aberta. A estação chama quando o admin abrir a sessão.</p>`;
    const cur = station.current && byId(s.queue, station.current);
    const next = E.callOrder(st, s.id, station.id)[0];
    let now = `<div class="station-now"><div><div class="muted">Em atendimento</div><div class="senha">—</div></div></div>`;
    if (cur) {
      const left = Math.max(0, st.config.toleranceMin * MIN - (st.now - cur.calledAt));
      const mm = Math.floor(left / MIN);
      const ss = String(Math.floor((left % MIN) / 1000)).padStart(2, "0");
      now = `<div class="station-now"><div><div class="muted">Chamado</div><div class="senha">${cur.senha}</div><div>${esc(cur.name)}</div></div>
        <div style="text-align:right"><div class="muted">tolerância</div><div class="tolerance">${mm}:${ss}</div></div></div>`;
    }
    const dis = station.open ? "" : "disabled";
    return `${select}
      ${now}
      <div class="row between" style="margin-bottom:10px"><span class="muted">Próximo:</span><strong>${next ? `${next.senha} · ${esc(next.name)}` : "ninguém presente"}</strong></div>
      ${ui.stationMsg ? `<div class="banner">${ui.stationMsg}</div>` : ""}
      <div class="station-actions">
        <button class="btn primary" data-act="st-next" ${dis}>Chamar próximo</button>
        <button class="btn soft" data-act="st-recall" ${cur ? dis : "disabled"}>Rechamar</button>
        <button class="btn soft" data-act="st-finish" ${cur ? dis : "disabled"}>Finalizar</button>
        <button class="btn ghost" data-act="st-skip" ${cur ? dis : "disabled"} style="grid-column:1/-1">Pular (não compareceu)</button>
      </div>
      ${station.open ? "" : `<p class="muted">Abra a estação em Admin da unidade.</p>`}`;
  }

  // ---------- TV ----------

  const TV_HIGHLIGHT = 10000;

  function tvHTML() {
    const v = E.tvView(st);
    if (!v.paired)
      return `<div class="tv-pair"><div><p>Fila Saúde · TV</p><div class="code">${v.code.slice(0, 3)} ${v.code.slice(3)}</div><p>Digite este código no painel do admin para parear.</p></div></div>`;
    if (!ui.tvStarted)
      return `<div class="tv-start"><button class="btn" data-act="tv-start">Iniciar painel</button></div>`;

    for (const a of v.announcements) {
      if (!ui.tvSeen.has(a.id)) {
        ui.tvSeen.add(a.id);
        ui.tvPending.push(a);
      }
    }
    const real = Date.now();
    if (ui.tvCur && real >= ui.tvCur.until) {
      ui.tvShown.unshift(ui.tvCur.a);
      ui.tvCur = null;
    }
    if (!ui.tvCur && ui.tvPending.length) {
      ui.tvCur = { a: ui.tvPending.shift(), until: real + TV_HIGHLIGHT, startedAt: real };
      beep();
    }
    const cur = ui.tvCur?.a;
    const flash = ui.tvCur && real - ui.tvCur.startedAt < 3000 ? "flash" : "";
    const last = ui.tvShown.slice(0, 5);
    const qrLeft = 30 - Math.floor((st.now % E.QR_STEP) / 1000);
    return `<div class="tv-grid">
      <div class="tv-now ${flash}" data-k="${cur?.id || ""}">
        <span class="tv-label">CHAMANDO AGORA</span>
        ${cur ? `<div class="senha">${cur.senha}</div><div class="dest">${esc(cur.service)} → ${esc(cur.dest)}</div>` : `<div class="senha" style="opacity:.25">—</div>`}
      </div>
      <div class="tv-last"><span class="tv-label">ÚLTIMAS CHAMADAS</span>
        <ul>${last.map((a) => `<li><strong>${a.senha}</strong><span>${esc(a.dest)}</span></li>`).join("") || `<li class="muted">—</li>`}</ul>
      </div>
      <div class="tv-counters">${
        v.counters
          .map(
            (c) =>
              `<div><span class="svc">${esc(c.name.toUpperCase())}</span> ${c.aguardando} aguardando · +${c.caminho} a caminho</div>`,
          )
          .join("") || `<div class="muted">Nenhuma sessão aberta</div>`
      }</div>
      <div class="tv-qr">${v.qr ? `${qrSvg(v.qr)}<div><p><strong>QR DE ENTRADA</strong></p><p>Leia ao chegar</p><p>troca em ${qrLeft}s</p></div>` : `<p>QR aparece quando a sessão abrir</p>`}</div>
    </div>`;
  }

  // ---------- Topo ----------

  function scenariosHTML() {
    return Object.entries(SCENARIOS)
      .map(
        ([k, sc]) =>
          `<button aria-pressed="${ui.scenario === k}" data-act="scenario" data-id="${k}">${sc.title}</button>`,
      )
      .join("");
  }

  function guideHTML() {
    const sc = SCENARIOS[ui.scenario];
    return `<div class="guide-head"><strong>${sc.title}</strong><p>${sc.intro}</p></div><ol>${sc.steps.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>`;
  }

  function clockHTML() {
    return `<time>${fClock.format(st.now)}</time>
      <button data-act="adv" data-ms="${MIN}">+1 min</button>
      <button data-act="adv" data-ms="${5 * MIN}">+5 min</button>
      <button data-act="adv" data-ms="${60 * MIN}">+1 h</button>
      <button data-act="adv" data-ms="${DAY}">+1 dia</button>
      <button class="reset" data-act="scenario" data-id="${ui.scenario}">Recomeçar</button>`;
  }

  function personaHTML() {
    const sc = SCENARIOS[ui.scenario];
    return sc.personas
      .map((id) => {
        const unread = st.notifications.filter((n) => n.patientId === id && !ui.read.has(n.id)).length;
        return `<option value="${id}" ${id === ui.persona ? "selected" : ""}>${esc(patient(id).name)}${unread ? ` (${unread})` : ""}</option>`;
      })
      .join("");
  }

  // ---------- Render ----------

  const regions = {
    scenarios: document.getElementById("scenarios"),
    guide: document.getElementById("guide"),
    clock: document.getElementById("clock"),
    persona: document.getElementById("persona"),
    phone: document.getElementById("phone"),
    admin: document.getElementById("admin"),
    station: document.getElementById("station"),
    tv: document.getElementById("tv"),
  };

  function put(el, html, force) {
    if (el._html === html) return;
    const busy = el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);
    if (busy && !force) return;
    el.innerHTML = html;
    el._html = html;
  }

  function update(force = false) {
    checkToast();
    put(regions.scenarios, scenariosHTML(), force);
    put(regions.guide, guideHTML(), force);
    put(regions.clock, clockHTML(), force);
    put(regions.persona, personaHTML(), force);
    put(regions.phone, phoneHTML(), force);
    put(regions.admin, adminHTML(), force);
    put(regions.station, stationHTML(), force);
    put(regions.tv, tvHTML(), force);
  }

  function checkToast() {
    const fresh = st.notifications.filter((n) => !ui.toasted.has(n.id));
    for (const n of fresh) ui.toasted.add(n.id);
    const mine = fresh.filter((n) => n.patientId === ui.persona);
    if (mine.length) ui.toast = { pid: ui.persona, text: mine[mine.length - 1].text, until: Date.now() + 5000 };
  }

  // ---------- Ações ----------

  function startQuiz(serviceId) {
    const dup = E.activeEntry(st, ui.persona, serviceId);
    if (dup) {
      ui.result = { kind: "dup", entryId: dup.id };
      ui.screen = "result";
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
    else if (r.error === "duplicada") ui.result = { kind: "dup", entryId: r.existing.id };
    else ui.result = { kind: "emergencia" };
  }

  const actions = {
    scenario: (d) => load(d.id),
    adv: (d) => E.advance(st, Number(d.ms)),
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
      ui.agSel = null;
    },
    sheet: (d) => {
      ui.sheet = d.id || null;
    },
    scan: () => scan(false),
    "scan-old": () => scan(true),
    leave: () => {
      const s = openSession();
      E.leave(st, s.id, ui.persona);
      ui.qrMsg = { ok: true, text: "Você está remoto. Sua posição foi mantida." };
    },
    tab: (d) => {
      ui.tab = d.id;
    },
    "ag-toggle": (d) => {
      if (ui.agSel.has(d.id)) ui.agSel.delete(d.id);
      else ui.agSel.add(d.id);
    },
    "ag-alloc": () => {
      const r = E.allocate(st, ui.agSessionId, [...ui.agSel], { version: ui.agVersion });
      const s = sessionOf(ui.agSessionId);
      if (r.ok)
        ui.agMsg = {
          ok: true,
          text: `${ui.agSel.size} paciente(s) alocado(s). Cada um recebeu “confirme em 24 h” e entrou na lista de ligação.`,
        };
      else if (r.error === "conflito")
        ui.agMsg = {
          ok: false,
          text: "Outro agendador alocou vagas desta sessão agora há pouco. A lista foi atualizada: revise e aloque de novo.",
        };
      else if (r.error === "sem_vagas") ui.agMsg = { ok: false, text: "A seleção passa das vagas livres da sessão." };
      else ui.agMsg = { ok: false, text: "Há entradas que não podem ser alocadas." };
      ui.agVersion = s.version;
      ui.agSel = null;
    },
    "ag-other": () => {
      const s = sessionOf(ui.agSessionId);
      const top = E.suggest(st, s.id)[0];
      if (top) E.allocate(st, s.id, [top.entry.id], { version: s.version });
    },
    "ref-accept": (d) => E.acceptReferral(st, d.id),
    "ref-reject": (d) => E.rejectReferral(st, d.id, document.getElementById(`reason-${d.id}`).value),
    "call-confirm": (d) => {
      E.confirmAllocation(st, d.id);
      ui.callMsg = { ok: true, text: `${patient(byId(st.entries, d.id).patientId).name}: confirmado pelo agendador.` };
    },
    "call-refuse": (d) => {
      const r = E.refuseAllocation(st, d.id);
      const nm = patient(byId(st.entries, d.id).patientId).name;
      ui.callMsg = {
        ok: false,
        text: `${nm} recusou. Vaga liberada; ${nm.split(" ")[0]} volta para a lista com a data original.${r.next ? ` Próximo sugerido: <b>${esc(patient(r.next.entry.patientId).name)}</b> (veja no Agendador).` : ""}`,
      };
      ui.agSel = null;
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
      const s = openSession();
      const r = E.frontDesk(st, s.id, { name: d.name.trim(), birth: d.birth, answers: d.answers });
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
      x.open = !x.open;
    },
    "tv-pair": () => {
      const r = E.pairTv(st, ui.tvCode.trim());
      ui.tvMsg = r.ok ? null : "Código não confere com o que aparece na TV.";
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
        : "Ninguém presente para chamar. Só é chamado quem leu o QR ou foi marcado pela recepção.";
    },
    "st-recall": () => E.recall(st, openSession().id, ui.stationId),
    "st-finish": () => {
      E.finish(st, openSession().id, ui.stationId);
      ui.stationMsg = null;
    },
    "st-skip": () => E.skip(st, openSession().id, ui.stationId),
  };

  function scan(old) {
    const s = openSession();
    if (!s) return;
    const token = E.qrToken(s, old ? st.now - 2 * MIN : st.now);
    const r = E.checkIn(st, s.id, ui.persona, token);
    ui.sheet = null;
    ui.qrMsg = r.ok
      ? { ok: true, text: "Check-in feito. Você está na unidade e já pode ser chamado." }
      : {
          ok: false,
          text:
            r.error === "qr_invalido"
              ? "QR expirado. Leia o código que está na TV agora."
              : "Você não está nesta fila.",
        };
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== "INPUT") ev.preventDefault();
    fn(el.dataset);
    update(true);
  });

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.id === "persona") {
      ui.persona = el.value;
      ui.screen = "home";
      ui.sheet = null;
      ui.qrMsg = null;
      ui.quiz = null;
      ui.toast = null;
    } else if (el.dataset.change === "ag-session") {
      ui.agSessionId = el.value;
      ui.agSel = null;
      ui.agVersion = sessionOf(el.value).version;
      ui.agMsg = null;
    } else if (el.dataset.change === "station") {
      ui.stationId = el.value;
      ui.stationMsg = null;
    } else if (el.dataset.change === "tri-level") {
      ui.triLevel[el.dataset.id] = el.value;
      return;
    } else if (el.dataset.bind === "motivo" || el.dataset.bind === "gravidade") {
      ui.desk.answers[el.dataset.bind] = el.value || null;
      if (el.dataset.bind === "motivo" && el.value !== "novo") ui.desk.answers.gravidade = null;
    } else return;
    update(true);
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset.bind === "name" || el.dataset.bind === "birth") ui.desk[el.dataset.bind] = el.value;
    if (el.dataset.bindTv) ui.tvCode = el.value;
  });

  setInterval(() => {
    E.advance(st, 1000);
    update(false);
  }, 1000);

  load("lista");
})();
