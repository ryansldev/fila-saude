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

  function allocateAt(st, sessionId, entries, when = BASE) {
    st.now = when;
    const version = st.sessions.find((s) => s.id === sessionId).version;
    E.allocate(
      st,
      sessionId,
      entries.map((e) => e.id),
      { version },
    );
    st.now = BASE;
  }

  // ---------- Predicados usados pelos roteiros ----------

  const entryOf = (st, pid, sid) => st.entries.find((e) => e.patientId === pid && e.serviceId === sid);
  const openSession = (st) => st.sessions.find((s) => s.state === "aberta");
  const itemOf = (st, pid) => openSession(st)?.queue.find((q) => q.patientId === pid);
  const quizOpts = (ids) => ids.map((id) => `[data-act="quiz-opt"][data-id="${id}"][aria-pressed="false"]`);
  const NEXT = '[data-act="quiz-next"]:not(:disabled)';
  const HOME = '[data-act="go"][data-screen="home"]';

  const SCENARIOS = {
    lista: {
      title: "Lista de espera e risco",
      personas: ["maria", "antonio", "lucia"],
      tabs: ["agendador"],
      tab: "agendador",
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
        return st;
      },
    },

    alocacao: {
      title: "Alocação e confirmação",
      personas: ["helena", "carlos", "edu", "dora", "ivo"],
      tabs: ["agendador", "ligacao"],
      tab: "agendador",
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
        allocateAt(st, "s-aloc", [ivo], BASE - 25 * 60 * MIN);
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
      personas: ["joao", "ana", "dora", "paulo", "bruno", "sergio"],
      tabs: ["admin", "recepcao", "triagem"],
      tab: "admin",
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
        allocateAt(st, "s-hoje", confirmed, BASE - 3 * DAY);
        for (const e of confirmed) E.confirmAllocation(st, e.id);
        allocateAt(st, "s-hoje", [seed(st, "sergio", "cli", 3, ans({ motivo: "exame" }))], BASE - 2 * 60 * MIN);
        return st;
      },
    },

    triagem: {
      title: "Triagem",
      personas: ["joao", "ana"],
      tabs: ["admin"],
      tab: "admin",
      tvReady: true,
      setup() {
        const st = baseState([
          {
            id: "s-tri",
            serviceId: "cli",
            start: at(0, 7),
            slots: 10,
            visibility: "privada",
            professional: "Dra. Marta",
          },
        ]);
        st.services.find((x) => x.id === "cli").avgTriageMin = 5;
        const confirmed = [
          seed(st, "ana", "cli", 30, ans({ motivo: "acompanhamento" })),
          seed(st, "joao", "cli", 20, ans({ motivo: "novo", gravidade: "leve" })),
        ];
        allocateAt(st, "s-tri", confirmed, BASE - 3 * DAY);
        for (const e of confirmed) E.confirmAllocation(st, e.id);
        st.tv.paired = true;
        return st;
      },
    },

    principal: {
      title: "Fluxo principal",
      personas: ["maria"],
      tabs: ["admin", "agendador"],
      tab: "admin",
      tvReady: true,
      protagonist: "maria",
      autoConfirm: true,
      travelMin: 20,
      setup() {
        const st = baseState([]);
        const cli = st.services.find((x) => x.id === "cli");
        cli.requiresTriage = true;
        cli.avgTriageMin = 5;
        E.createStation(st, { name: "Triagem 1", stage: "triagem", services: ["cli"] });
        // 12 pessoas já esperam na lista de Clínico geral, todas de rotina e sem prioridade legal.
        const others = [
          "ana",
          "joao",
          "bruno",
          "paulo",
          "sergio",
          "carlos",
          "edu",
          "gil",
          "helena",
          "lucia",
          "ivo",
          "fatima",
        ];
        others.forEach((pid, i) => {
          seed(st, pid, "cli", 60 - i * 4, ans({ motivo: "exame" }));
        });
        st.tv.paired = true;
        return st;
      },
      story: {
        headline: "da inscrição à consulta, sem enfrentar fila",
        intro:
          "Maria precisa de um clínico geral na UBS Vila Nova. Siga a história inteira: a unidade cadastra o atendimento, Maria se inscreve pelo app, espera em casa e só vai à unidade quando é a vez dela.",
        steps: [
          {
            html: "<b>Cadastre o atendimento.</b> Em <b>Nova sessão</b>: Clínico geral, amanhã, visibilidade <b>privada</b>. Clique <b>Criar sessão</b>.",
            why: "Pública: o paciente se inscreve sozinho até lotar. Privada: o agendador escolhe quem entra, pela lista de espera e pelo risco. Aqui usamos privada.",
            where: "painel › admin da unidade › nova sessão",
            tab: "admin",
            targets: (_st, ui) =>
              ui.newSession.visibility === "privada"
                ? ['[data-act="session-create"]']
                : ['[data-act="ns-vis"][data-id="privada"]'],
            done: (st) => st.sessions.some((x) => x.serviceId === "cli" && x.visibility === "privada"),
          },
          {
            html: "<b>Maria se inscreve.</b> No celular, toque na <b>UBS Vila Nova</b>, em <b>Entrar na lista</b> do Clínico geral e responda: <b>nenhum destes</b> · <b>exame, check-up ou rotina</b> · <b>nenhuma</b> · <b>nenhuma</b>.",
            why: "Ela já vê a sessão nova na agenda da unidade. Cinco toques, sem texto livre. Sinal de alarme nunca entra em fila: o app manda ligar 192.",
            where: "celular da Maria",
            persona: "maria",
            targets: [
              ...quizOpts(["nenhum", "exame", "nenhuma"]),
              NEXT,
              '[data-act="join"][data-id="cli"]',
              '.pin[data-id="u1"]',
              HOME,
            ],
            done: (st) => !!entryOf(st, "maria", "cli"),
          },
          {
            html: "<b>O agendador aprova.</b> Na aba <b>Agendador</b>, Maria aparece na sugestão. Deixe-a marcada e clique <b>Alocar</b>.",
            why: "Nada é alocado sozinho: quem o agendador não marcar continua na lista, com a data original. Os outros 12 pacientes confirmam pelo app.",
            where: "painel › agendador",
            tab: "agendador",
            targets: ['[data-act="ag-alloc"]:not(:disabled)'],
            done: (st) => ["alocada", "confirmada", "na_fila"].includes(entryOf(st, "maria", "cli")?.status),
          },
          {
            html: "<b>Maria confirma.</b> No celular, abra a solicitação e toque em <b>Confirmar</b>.",
            why: "Ela tem 24 h para confirmar. Quem não vê o push aparece na lista de ligação do agendador.",
            where: "celular › minhas solicitações",
            persona: "maria",
            targets: ['[data-act="confirm-alloc"]', '[data-act="entry"]', HOME],
            done: (st) => ["confirmada", "na_fila"].includes(entryOf(st, "maria", "cli")?.status),
          },
          {
            html: "<b>Chegou o dia.</b> Avance <b>+1 dia</b> no relógio da demo.",
            why: "No protótipo o relógio é seu: o resto da demonstração acontece no dia da consulta.",
            where: "topo › relógio da demo",
            targets: [`[data-act="adv"][data-ms="${DAY}"]`],
            done: (_st, ui) => ui.events.has("adv:day"),
          },
          {
            html: "<b>A unidade abre a sessão.</b> No Admin, clique <b>Abrir sessão</b>.",
            why: "Os 13 confirmados entram na fila remota, primeiro a da triagem. Maria vê a posição e o tempo sem sair de casa.",
            where: "painel › admin da unidade › sessões",
            tab: "admin",
            targets: ['[data-act="open-session"]'],
            done: (st) => !!openSession(st),
          },
          {
            html: "<b>Maria espera em casa.</b> Clique <b>Esperar até o próximo aviso</b>.",
            why: "O relógio anda e a unidade trabalha: os outros chegam, passam pela triagem e pelo consultório. Quando a triagem da Maria se aproxima, chega o “saia de casa”.",
            where: "topo › esperar até o próximo aviso",
            targets: ['[data-act="sim"]'],
            done: (st) => st.notifications.some((n) => n.patientId === "maria" && n.text.includes("Saia de casa")),
          },
          {
            html: "<b>Maria chega e lê o QR.</b> No celular, toque em <b>Cheguei: ler QR da TV</b>.",
            why: "O aviso chega uns 30 min antes, tempo de ir até a unidade (aqui, 20 min de trajeto). Só é chamado quem está lá: o QR da TV troca a cada 30 s e foto antiga não vale.",
            where: "celular › fila de hoje",
            persona: "maria",
            targets: ['[data-act="scan"]', '[data-act="sheet"][data-id="qr"]', '[data-act="go"][data-screen="queue"]'],
            done: (st) => !!itemOf(st, "maria")?.presentSince || itemOf(st, "maria")?.stage === "atendimento",
          },
          {
            html: "<b>A triagem chama.</b> Clique <b>Esperar até o próximo aviso</b> até a Triagem 1 chamar a Maria.",
            why: "A TV mostra a senha dela com destino na triagem. Quem chegou antes dela na sala é chamado antes.",
            where: "topo › esperar até o próximo aviso",
            targets: ['[data-act="sim"]'],
            done: (st) => {
              const q = itemOf(st, "maria");
              return !!q && (q.stage === "atendimento" || q.status === "chamado");
            },
          },
          {
            html: "<b>A enfermeira atende.</b> Na estação <b>Triagem 1</b>, clique <b>Finalizar triagem</b>.",
            why: "Na triagem, a enfermeira pode confirmar ou mudar o risco (palavra final). Depois, Maria vai para a fila do consultório com a mesma senha.",
            where: "estação › Triagem 1",
            targets: (st, ui) =>
              st.stations.find((x) => x.id === ui.stationId)?.stage === "triagem"
                ? ['[data-act="st-finish"]:not(:disabled)']
                : ['[data-change="station"]'],
            done: (st) => itemOf(st, "maria")?.stage === "atendimento",
          },
          {
            html: "<b>A fila do consultório está grande.</b> Veja no celular quanto falta e toque em <b>Vou sair</b>.",
            why: "Depois da triagem ninguém precisa ficar na sala. Maria mantém o lugar e será avisada de novo quando a consulta se aproximar.",
            where: "celular › fila de hoje",
            persona: "maria",
            targets: ['[data-act="leave"]', '[data-act="go"][data-screen="queue"]'],
            done: (_st, ui) => ui.events.has("leave:atendimento"),
          },
          {
            html: "<b>Maria passeia, almoça, resolve a vida.</b> Clique <b>Esperar até o próximo aviso</b>.",
            why: "Enquanto isso o consultório atende quem está na frente. Quando faltar uns 30 minutos, chega o novo “saia de casa”.",
            where: "topo › esperar até o próximo aviso",
            targets: ['[data-act="sim"]'],
            done: (st, ui) =>
              ui.events.has("leave:atendimento") &&
              st.notifications.some(
                (n) => n.patientId === "maria" && n.text.includes("Saia de casa") && n.at >= ui.leaveAt,
              ),
          },
          {
            html: "<b>Maria volta</b> e lê o QR de novo.",
            why: "Ela não perdeu a vez: ninguém com número maior que o dela foi chamado enquanto estava fora.",
            where: "celular › fila de hoje",
            persona: "maria",
            targets: ['[data-act="scan"]', '[data-act="sheet"][data-id="qr"]', '[data-act="go"][data-screen="queue"]'],
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
            html: "<b>A vez dela.</b> Clique <b>Esperar até o próximo aviso</b> até o Consultório 3 chamar a Maria.",
            why: "A TV chama a mesma senha, agora para o consultório. Maria recebe “sua vez” no celular.",
            where: "topo › esperar até o próximo aviso",
            targets: ['[data-act="sim"]'],
            done: (st) => {
              const q = st.sessions.flatMap((x) => x.queue).find((x) => x.patientId === "maria");
              return !!q && q.stage === "atendimento" && ["chamado", "atendido"].includes(q.status);
            },
          },
          {
            html: "<b>Consulta feita.</b> Na estação <b>Consultório 3</b>, clique <b>Finalizar</b>. Veja o resumo no celular da Maria.",
            why: "Maria foi atendida e passou pouco tempo na unidade: o resto da espera foi em casa.",
            where: "estação › Consultório 3",
            targets: (st, ui) =>
              st.stations.find((x) => x.id === ui.stationId)?.stage === "atendimento"
                ? ['[data-act="st-finish"]:not(:disabled)']
                : ['[data-change="station"]'],
            done: (st) =>
              st.sessions.flatMap((x) => x.queue).some((x) => x.patientId === "maria" && x.status === "atendido"),
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
