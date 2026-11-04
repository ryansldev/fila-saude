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
      story: {
        num: 1,
        file: "historia-lista.html",
        headline: "o paciente diz o que sente, de casa",
        intro:
          "Maria acha a unidade no mapa e entra na lista respondendo 5 perguntas de toque. Sinais de alarme nunca esperam na fila.",
        steps: [
          {
            html: "No celular da <b>Maria</b>, toque na <b>UBS Vila Nova</b> no mapa.",
            why: "O paciente vê horário, sessões e vagas de cada unidade. Nunca vê quem está na lista.",
            where: "celular › mapa",
            persona: "maria",
            targets: ['.pin[data-id="u1"]', HOME],
            done: (_st, ui) => ui.events.has("unit:u1"),
          },
          {
            html: "Toque em <b>Entrar na lista</b> de Clínico geral. Responda: <b>nenhum destes</b> · <b>problema novo</b> · <b>moderado</b> · <b>nenhuma</b> · <b>nenhuma</b>.",
            why: "São 5 telas de toque, sem texto livre, em menos de 1 minuto. O nível é uma sugestão: a equipe confirma.",
            where: "celular › questionário",
            persona: "maria",
            targets: [
              ...quizOpts(["nenhum", "novo", "moderado", "nenhuma"]),
              NEXT,
              '[data-act="join"][data-id="cli"]',
              '.pin[data-id="u1"]',
              HOME,
            ],
            done: (st) => !!entryOf(st, "maria", "cli"),
          },
          {
            html: "Volte ao mapa e tente <b>entrar de novo</b> em Clínico geral.",
            why: "Uma entrada por serviço: ninguém ocupa dois lugares na mesma lista. O app mostra a que já existe.",
            where: "celular › UBS Vila Nova",
            persona: "maria",
            targets: ['[data-act="join"][data-id="cli"]', '.pin[data-id="u1"]', HOME],
            done: (_st, ui) => ui.events.has("dup"),
          },
          {
            html: "Abra a <b>Policlínica Centro</b>, entre em <b>Cardiologia</b> (motivo: exame) e tire a <b>foto do encaminhamento</b>.",
            why: "Especialidade pede encaminhamento. A foto vai para o agendador conferir, sem papel.",
            where: "celular › Policlínica Centro",
            persona: "maria",
            targets: [
              '[data-act="photo"][data-taken="false"]',
              ...quizOpts(["nenhum", "exame", "nenhuma"]),
              NEXT,
              '[data-act="join"][data-id="car"]',
              '.pin[data-id="u2"]',
              HOME,
            ],
            done: (st) => !!entryOf(st, "maria", "car"),
          },
          {
            html: "No painel do agendador, <b>aceite</b> ou <b>rejeite</b> o encaminhamento da Maria.",
            why: "O agendador confere validade e serviço. A Maria recebe o aviso no celular na mesma hora.",
            where: "painel › agendador",
            tab: "agendador",
            targets: ['[data-act="ref-accept"]'],
            done: (st) => {
              const e = entryOf(st, "maria", "car");
              return !!e && e.referral.status !== "pendente";
            },
          },
          {
            html: "Troque para o <b>Antônio</b>. Entre em Clínico geral e marque <b>Dor ou aperto forte no peito</b>.",
            why: "Sinal de alarme não entra em fila nenhuma: o app manda ligar 192 na hora.",
            where: "celular › questionário",
            persona: "antonio",
            targets: [...quizOpts(["dor_peito"]), NEXT, '[data-act="join"][data-id="cli"]', '.pin[data-id="u1"]', HOME],
            done: (_st, ui) => ui.events.has("emergencia:antonio"),
          },
          {
            html: "Troque para a <b>Lúcia</b>. Entre em Clínico geral, marque <b>Pensamentos de tirar a própria vida</b> e siga até o fim.",
            why: "CVV 188 e SAMU 192 aparecem em destaque. Ela pode seguir: entra como urgente e o agendador recebe um alerta.",
            where: "celular › questionário",
            persona: "lucia",
            targets: [
              ...quizOpts(["autolesao"]),
              '[data-act="support-continue"]',
              ...quizOpts(["receita", "nenhuma"]),
              NEXT,
              '[data-act="join"][data-id="cli"]',
              '.pin[data-id="u1"]',
              HOME,
            ],
            done: (st) => !!entryOf(st, "lucia", "cli"),
          },
        ],
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
      story: {
        num: 2,
        file: "historia-alocacao.html",
        headline: "a unidade organiza as vagas",
        intro:
          "Sexta tem 4 vagas de Clínico geral e uma já é do Ivo. O agendador preenche as outras 3 com a ajuda do sistema, e ninguém é alocado sozinho.",
        steps: [
          {
            html: "Veja a sugestão para sexta: a <b>Dora</b>, 82 anos, ficou fora das 3 vagas. Troque a <b>regra do município</b> para <b>Prioridade legal antes</b>.",
            why: "A Dora entra e o Carlos, urgente ainda não confirmado, sai. Esse é o dilema da área técnica: cada município escolhe a regra, e o protótipo mostra o efeito na hora.",
            where: "painel › agendador › regra do município",
            tab: "agendador",
            targets: ['[data-act="rule"][data-id="legal"]'],
            done: (st) => st.config.priorityOrder === "legal",
          },
          {
            html: "Escolha a regra que preferir, deixe as 3 vagas marcadas e clique <b>Alocar</b>.",
            why: "O sistema sugere e explica. O agendador decide: urgência confirmada, remanejados, risco, prioridade legal e tempo de espera.",
            where: "painel › agendador",
            tab: "agendador",
            targets: ['[data-act="ag-alloc"]:not(:disabled)'],
            done: (st) => st.entries.filter((e) => e.status === "alocada" && e.patientId !== "ivo").length > 0,
          },
          {
            html: "No celular da <b>Helena</b>, abra a vaga e toque em <b>Confirmar</b>.",
            why: "O paciente tem 24 h para confirmar pelo app. O push avisa, mas muita gente não vê.",
            where: "celular › minhas solicitações",
            persona: "helena",
            targets: ['[data-act="confirm-alloc"]', '[data-act="entry"]', HOME],
            done: (st) => st.entries.some((e) => e.patientId === "helena" && e.status === "confirmada"),
          },
          {
            html: "Na <b>Lista de ligação</b>, o Ivo está destacado: mais de 24 h sem resposta. Ligue e registre <b>Recusou</b> em alguém.",
            why: "Na prática, a ligação é o caminho principal. A recusa libera a vaga na hora e o próximo é sugerido.",
            where: "painel › lista de ligação",
            tab: "ligacao",
            targets: ['[data-act="call-refuse"]'],
            done: (_st, ui) => ui.events.has("refuse"),
          },
          {
            html: "No agendador, clique <b>Simular outro agendador</b> e depois <b>Alocar</b>.",
            why: "Dois agendadores nunca ocupam a mesma vaga. Quem chega segundo recebe um erro e a lista atualizada.",
            where: "painel › agendador",
            tab: "agendador",
            targets: (_st, ui) =>
              ui.events.has("other")
                ? ['[data-act="ag-alloc"]:not(:disabled)']
                : ['[data-act="ag-other"]:not(:disabled)'],
            done: (_st, ui) => ui.events.has("conflict"),
          },
          {
            html: "Avance <b>+1 dia</b> no relógio da demo e abra a <b>Lista de ligação</b>.",
            why: "Quem não respondeu em 24 h fica destacado para o agendador ligar primeiro.",
            where: "topo › relógio da demo",
            targets: (_st, ui) =>
              ui.events.has("adv:day")
                ? ['[data-act="tab"][data-id="ligacao"]']
                : [`[data-act="adv"][data-ms="${DAY}"]`],
            done: (_st, ui) => ui.events.has("adv:day") && ui.tab === "ligacao",
          },
        ],
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
      story: {
        num: 3,
        file: "historia-fila.html",
        headline: "espera em casa, chega na hora",
        intro:
          "Hoje é dia de Clínico geral na UBS Vila Nova. Seis pacientes confirmados esperam em casa. Só vai à unidade quem está perto da vez.",
        steps: [
          {
            html: "Pareie a TV: digite no Admin o <b>código que aparece na TV</b> e clique <b>Parear</b>.",
            why: "Sem pareamento a TV não mostra nada da unidade. Isso protege o QR de entrada.",
            where: "painel › admin da unidade",
            tab: "admin",
            targets: ['[data-bind-tv="code"]'],
            done: (st) => st.tv.paired,
          },
          {
            html: "Na TV, toque em <b>Iniciar painel</b>.",
            why: "O toque libera o som do aviso de chamada no navegador da TV.",
            where: "TV da sala de espera",
            targets: ['[data-act="tv-start"]'],
            done: (_st, ui) => ui.tvStarted,
          },
          {
            html: "No Admin, clique <b>Abrir sessão</b>.",
            why: "Os confirmados entram na fila remota com senha e recebem um push. A vaga de quem não confirmou (Sérgio) é liberada.",
            where: "painel › admin da unidade",
            tab: "admin",
            targets: ['[data-act="open-session"]'],
            done: (st) => !!openSession(st),
          },
          {
            html: "Veja o celular da <b>Dora</b>: ela é a 1ª da fila e ainda está em casa.",
            why: "Dora tem 82 anos e prioridade legal. O app diz “venha agora”: ela só é chamada depois de ler o QR, e ninguém presente espera por ela.",
            where: "celular › Dora",
            persona: "dora",
            targets: [],
            done: (_st, ui) => ui.events.has("see:dora"),
          },
          {
            html: "Troque para o <b>João</b>: toque em <b>Cheguei: ler QR da TV</b> e leia o QR.",
            why: "Só é chamado quem está na unidade. O QR troca a cada 30 s: foto antiga não vale.",
            where: "celular › fila de hoje",
            persona: "joao",
            targets: ['[data-act="scan"]', '[data-act="sheet"][data-id="qr"]', '[data-act="go"][data-screen="queue"]'],
            done: (st) => itemOf(st, "joao")?.presence === "presente",
          },
          {
            html: "Agora a <b>Ana</b> chega e lê o QR. Veja a posição dela.",
            why: "Ana tem número melhor, mas João já estava na sala: ele é chamado primeiro (janela protegida). O app dela mostra “2º a ser chamado”.",
            where: "celular › Ana",
            persona: "ana",
            targets: ['[data-act="scan"]', '[data-act="sheet"][data-id="qr"]', '[data-act="go"][data-screen="queue"]'],
            done: (st) => itemOf(st, "ana")?.presence === "presente",
          },
          {
            html: "Na estação do consultório, clique <b>Chamar próximo</b>.",
            why: "A TV mostra a senha e a sala com um bipe, e o paciente recebe “sua vez”. Na TV aparecem só senhas, nunca nomes.",
            where: "estação de chamada",
            targets: ['[data-act="st-next"]:not(:disabled)'],
            done: (st) => st.tv.announcements.length > 0,
          },
          {
            html: "Na <b>Triagem</b>, mude o nível do <b>Paulo</b> para <b>Urgente</b> e clique <b>Confirmar</b>.",
            why: "Urgência confirmada por um profissional passa na frente de todos. Paulo está em casa: recebe “venha agora” na hora.",
            where: "painel › triagem",
            tab: "triagem",
            targets: (st, ui) => {
              const q = itemOf(st, "paulo");
              const picked = q && ui.triLevel[q.id] === "urgente";
              return picked
                ? ['[data-act="tri-confirm"][data-pid="paulo"]']
                : ['[data-change="tri-level"][data-pid="paulo"]'];
            },
            done: (st) => itemOf(st, "paulo")?.confirmedLevel === "urgente",
          },
          {
            html: "Finja que o chamado não apareceu: avance <b>+5 min</b> no relógio.",
            why: "Passou a tolerância, ele é pulado e continua presente, logo atrás do próximo. No 2º pulo volta para casa; no 3º sai da fila.",
            where: "topo › relógio da demo",
            targets: (st) => {
              const s = openSession(st);
              const calling = s && st.stations.some((x) => x.current);
              return calling ? ['[data-act="adv"][data-ms="300000"]'] : ['[data-act="st-next"]:not(:disabled)'];
            },
            done: (st) => !!openSession(st)?.queue.some((q) => q.skips > 0),
          },
          {
            html: "Na <b>Recepção</b>, inclua no balcão alguém sem celular: nome, motivo e <b>Incluir no balcão</b>.",
            why: "Ninguém fica de fora. Quem não tem app entra presente, na mesma fila, e recebe a senha no papel.",
            where: "painel › recepção",
            tab: "recepcao",
            targets: (_st, ui) => {
              if (!ui.desk.name.trim()) return ["#desk-name"];
              if (!ui.desk.answers.motivo) return ["#desk-motivo"];
              return ['[data-act="desk-submit"]'];
            },
            done: (st) => !!openSession(st)?.queue.some((q) => q.origin === "balcao"),
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
