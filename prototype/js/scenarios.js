// Dados fictícios e roteiros das histórias. Cada passo sabe onde clicar e quando está feito.
(() => {
  const E = window.Engine;
  const { MIN, DAY } = E;
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
    { key: "condicoes", q: "Você tem alguma destas condições?", multi: true, opts: CONDICOES, none: [NONE, "Nenhuma"] },
    { key: "grupos", q: "Alguma destas se aplica a você?", multi: true, opts: GRUPOS, none: [NONE, "Nenhuma"] },
  ];

  const emptyAnswers = (grupos = []) => ({ alarms: [], motivo: null, gravidade: null, condicoes: [], grupos });
  const ans = (over) => ({ ...emptyAnswers(), ...over });

  // ---------- Pessoas e unidades fictícias ----------

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
        // AD-011: clínico geral é sempre público; odontologia é privada (o paciente só sinaliza interesse).
        { id: "cli", unitId: "u1", name: "Clínico geral", prefix: "C", requiresReferral: false, visibility: "pública" },
        { id: "odo", unitId: "u1", name: "Odontologia", prefix: "O", requiresReferral: false, visibility: "privada" },
        { id: "car", unitId: "u2", name: "Cardiologia", prefix: "K", requiresReferral: true },
        { id: "der", unitId: "u2", name: "Dermatologia", prefix: "D", requiresReferral: true },
        {
          id: "cli3",
          unitId: "u3",
          name: "Clínico geral",
          prefix: "G",
          requiresReferral: false,
          visibility: "pública",
        },
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

  function enrollAt(st, pid, sessionId, hoursAgo, answers) {
    st.now = BASE - hoursAgo * 60 * MIN;
    E.enroll(st, sessionId, { patientId: pid, answers });
    st.now = BASE;
  }

  // ---------- Predicados usados pelos roteiros ----------

  const entryOf = (st, pid, sid) => st.entries.find((e) => e.patientId === pid && e.serviceId === sid);
  const openSession = (st) => st.sessions.find((s) => s.state === "aberta");
  const itemOf = (st, pid) => openSession(st)?.queue.find((q) => q.patientId === pid);
  const quizOpts = (ids) => ids.map((id) => `[data-act="quiz-opt"][data-id="${id}"][aria-pressed="false"]`);
  const NEXT = '[data-act="quiz-next"]:not(:disabled)';
  const HOME = '[data-act="go"][data-screen="home"]';
  const queueItem = (st) => st.sessions.flatMap((x) => x.queue).find((x) => x.patientId === "maria");
  const notifiedSince = (st, at) =>
    st.notifications.some((n) => n.patientId === "maria" && n.text.startsWith("Saia de casa") && n.at >= at);
  const calledAt = (st, stage) => {
    const q = queueItem(st);
    return !!q && q.stage === stage && q.status === "chamado";
  };

  const SCENARIOS = {
    principal: {
      title: "Fluxo guiado",
      description: "História completa da Maria, do cadastro da sessão à consulta, com roteiro.",
      personas: ["maria"],
      tabs: ["admin", "agendador"],
      tab: "agendador",
      protagonist: "maria",
      autoConfirm: true,
      travelMin: 20,
      setup() {
        const st = baseState([]);
        const cli = st.services.find((x) => x.id === "cli");
        cli.requiresTriage = true;
        cli.avgTriageMin = 5;
        E.createStation(st, { name: "Triagem 1", stage: "triagem", services: ["cli"] });
        // Clínico geral de amanhã é público: 12 pessoas já se inscreveram sozinhas, cada uma numa hora.
        const pub = E.createSession(st, {
          serviceId: "cli",
          start: at(1, 7),
          slots: 20,
          visibility: "pública",
          professional: "Dra. Marta",
        });
        const special = {
          fatima: ans({ motivo: "novo", gravidade: "moderado" }),
          helena: ans({ motivo: "exame", grupos: ["gestante"] }),
        };
        ["ana", "joao", "bruno", "paulo", "sergio", "carlos", "edu", "gil", "helena", "lucia", "ivo", "fatima"].forEach(
          (pid, i) => {
            enrollAt(st, pid, pub.id, 30 - i * 2, special[pid] || ans({ motivo: "exame" }));
          },
        );
        // Odontologia é privada: quem tem interesse entra na lista e o agendador escolhe quem vai.
        E.createSession(st, {
          serviceId: "odo",
          start: at(4, 8),
          slots: 3,
          visibility: "privada",
          professional: "Dr. Caio",
        });
        seed(st, "dora", "odo", 41, ans({ motivo: "acompanhamento" }));
        seed(st, "rita", "odo", 25, ans({ motivo: "exame" }));
        seed(st, "carlos", "odo", 3, ans({ motivo: "novo", gravidade: "forte" }));
        seed(st, "antonio", "odo", 12, ans({ motivo: "exame" }));
        seed(st, "helena", "odo", 8, ans({ motivo: "exame", grupos: ["gestante"] }));
        seed(st, "ivo", "odo", 30, ans({ motivo: "exame" }));
        st.tv.paired = true;
        return st;
      },
      story: {
        intro: {
          title: "Conheça a Maria",
          text: "Maria precisa de um clínico geral na UBS Vila Nova. Veja como ela é atendida esperando em casa, e não numa fila.",
        },
        steps: [
          {
            title: "Maria se inscreve",
            text: "Clínico geral é sempre público: ela mesma escolhe o dia e pega a vaga, sem esperar aprovação. Antes, responde quatro perguntas de toque.",
            screen: "phone",
            persona: "maria",
            targets: [
              ...quizOpts(["nenhum", "exame", "nenhuma"]),
              NEXT,
              '[data-act="enroll"]',
              '.pin[data-id="u1"]',
              HOME,
            ],
            done: (st) => entryOf(st, "maria", "cli")?.status === "confirmada",
          },
          {
            title: "Na odontologia é diferente",
            text: "Odontologia é privada: o paciente só sinaliza interesse. O sistema sugere quem vai, com o motivo de cada um, e o agendador escolhe quem marcar.",
            screen: "allocate",
            tab: "agendador",
            targets: ['[data-act="ag-alloc"]:not(:disabled)'],
            done: (st) => st.entries.some((e) => e.serviceId === "odo" && ["alocada", "confirmada"].includes(e.status)),
          },
          {
            title: "Chegou o dia",
            text: "Avance até o dia da consulta e abra a sessão. Os inscritos entram na fila pela ordem de inscrição, sem sair de casa.",
            screen: "sessions",
            tab: "admin",
            clock: (_st, ui) => (ui.events.has("adv:day") ? null : "day"),
            targets: (_st, ui) =>
              ui.events.has("adv:day") ? ['[data-act="open-session"]'] : [`[data-act="adv"][data-ms="${DAY}"]`],
            done: (st) => !!openSession(st),
          },
          {
            title: "Maria espera em casa",
            text: "A fila anda sem ela. Quando a vez estiver perto, o app manda sair. Na unidade, ela lê o QR da TV.",
            screen: "phone",
            persona: "maria",
            clock: (st) => (notifiedSince(st, 0) ? null : "sim"),
            targets: (st) =>
              notifiedSince(st, 0)
                ? ['[data-act="scan"]', '[data-act="sheet"][data-id="qr"]', '[data-act="go"][data-screen="queue"]']
                : ['[data-act="sim"]'],
            done: (st) => !!itemOf(st, "maria")?.presentSince || itemOf(st, "maria")?.stage === "atendimento",
          },
          {
            title: "Triagem",
            text: "A enfermeira chama a Maria, confirma o risco e libera para o consultório. A senha é a mesma.",
            screen: "station",
            station: "triagem",
            clock: (st) => (calledAt(st, "triagem") ? null : "sim"),
            targets: (st) =>
              calledAt(st, "triagem") ? ['[data-act="st-finish"]:not(:disabled)'] : ['[data-act="sim"]'],
            done: (st) => itemOf(st, "maria")?.stage === "atendimento",
          },
          {
            title: "Maria sai e volta",
            text: "O consultório ainda vai demorar. Ela sai sem perder o lugar e volta quando o app avisar.",
            screen: "phone",
            persona: "maria",
            clock: (st, ui) => (ui.events.has("leave:atendimento") && !notifiedSince(st, ui.leaveAt) ? "sim" : null),
            targets: (st, ui) => {
              if (!ui.events.has("leave:atendimento"))
                return ['[data-act="leave"]', '[data-act="go"][data-screen="queue"]'];
              if (!notifiedSince(st, ui.leaveAt)) return ['[data-act="sim"]'];
              return ['[data-act="scan"]', '[data-act="sheet"][data-id="qr"]', '[data-act="go"][data-screen="queue"]'];
            },
            done: (st, ui) => {
              const q = itemOf(st, "maria");
              return (
                ui.events.has("leave:atendimento") &&
                !!q &&
                q.stage === "atendimento" &&
                (q.presence === "presente" || q.status !== "fila")
              );
            },
          },
          {
            title: "A vez dela",
            text: "A TV chama a senha da Maria, nunca o nome.",
            screen: "tv",
            clock: "sim",
            station: "atendimento",
            targets: ['[data-act="sim"]'],
            done: (st) => {
              const q = queueItem(st);
              return !!q && q.stage === "atendimento" && ["chamado", "atendido"].includes(q.status);
            },
          },
          {
            title: "Consulta",
            text: "O médico atende e finaliza na estação.",
            screen: "station",
            station: "atendimento",
            targets: ['[data-act="st-finish"]:not(:disabled)'],
            done: (st) => queueItem(st)?.status === "atendido",
          },
        ],
      },
    },
  };

  window.Scenarios = {
    BASE,
    QUIZ,
    ALARMS,
    MOTIVOS,
    GRAVIDADE,
    CONDICOES,
    GRUPOS,
    NONE,
    NONE1,
    emptyAnswers,
    SCENARIOS,
  };
})();
