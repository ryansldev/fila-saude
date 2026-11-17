import type { ApiRiskLevel, StationCommand, StationOperation } from "@fila-saude/schemas/queue";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FootprintsIcon,
  HeartIcon,
  MegaphoneIcon,
  PauseIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RiskCard } from "@/components/ui/risk-card";
import { stopwatch } from "@/lib/queue";
import { calledPhase, oldestPill, waitText } from "@/lib/station";
import { canRefer, levelColor, needsClassify, priorityText, TRIAGE_COLORS } from "@/lib/triage";
import { cn } from "@/lib/utils";

type Props = {
  op: StationOperation;
  color: ApiRiskLevel | null;
  onChooseColor: (level: ApiRiskLevel) => void;
  onCommand: (c: StationCommand, refer?: boolean) => void;
  sending: boolean;
  /** Hora do servidor (já com o desvio do relógio). */
  now: number;
};

function Pill({ icon, tone = "neutral", children }: { icon: ReactNode; tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold",
        TONES[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
type Tone = "neutral" | "alert" | "late" | "room";
const TONES: Record<Tone, string> = {
  neutral: "border-[var(--ds-line)] bg-white text-slate-700",
  alert: "border-amber-200 bg-amber-50 text-amber-900",
  late: "border-red-200 bg-red-50 text-red-800",
  room: "border-green-200 bg-green-50 text-green-800",
};

const ICON = "size-3.5";

/** Quem aguarda na unidade (na ordem de chamada) e quem está a caminho: senha e primeiro nome. */
function StationQueue({ op, now }: { op: StationOperation; now: number }) {
  const old = oldestPill(op.oldest, now);
  const more = (n: number, shown: number) =>
    n > shown ? (
      <span className="rounded-lg border border-[var(--ds-line)] px-2 py-1 text-xs font-bold">+{n - shown}</span>
    ) : null;
  return (
    <section
      aria-label="Fila da estação"
      className="grid gap-4 rounded-2xl border border-[var(--ds-line)] bg-white px-4 py-3 md:grid-cols-[1.4fr_1fr]"
    >
      <div className="flex flex-col gap-2">
        <h2 className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-slate-900">
          <UsersIcon className={cn(ICON, "text-green-700")} aria-hidden />
          aguardando na unidade
          <span className="rounded-full bg-slate-100 px-2">{op.waiting}</span>
          {old ? (
            <Pill tone={old.late ? "late" : "alert"} icon={<ClockIcon className="size-3" aria-hidden />}>
              {old.text}
            </Pill>
          ) : null}
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {op.upcoming.length === 0 ? <li className="text-sm text-slate-500">ninguém ainda</li> : null}
          {op.upcoming.map((p) => (
            <li
              key={p.ticket}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-line)] bg-white px-2 py-1 text-xs font-bold text-slate-900"
            >
              <span className="font-mono font-extrabold">{p.ticket}</span>
              {p.name}
              <span className="font-semibold text-slate-500">{waitText(p.presentSince, now)}</span>
            </li>
          ))}
          {more(op.waiting, op.upcoming.length)}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
          <FootprintsIcon className={cn(ICON, "text-primary")} aria-hidden />a caminho
          <span className="rounded-full bg-slate-100 px-2">{op.remote}</span>
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {op.onTheWay.length === 0 ? <li className="text-sm text-slate-500">ninguém</li> : null}
          {op.onTheWay.map((p) => (
            <li
              key={p.ticket}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600"
            >
              <span className="font-mono font-extrabold">{p.ticket}</span>
              {p.name}
            </li>
          ))}
          {more(op.remote, op.onTheWay.length)}
        </ul>
      </div>
    </section>
  );
}

function Tracejado({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-extrabold text-slate-900">{title}</p>
        {text ? <p className="text-sm text-slate-600">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** A estação com a sessão aberta: a fila, quem está chamado (em duas fases) e as ações. */
export function StationPanel({ op, color, onChooseColor, onCommand, sending, now }: Props) {
  const called = op.called;
  const triage = op.station.stage === "triage";
  return (
    <div className="flex flex-col gap-3">
      <StationQueue op={op} now={now} />
      {called ? (
        <Called
          op={op}
          called={called}
          triage={triage}
          color={color}
          onChooseColor={onChooseColor}
          onCommand={onCommand}
          sending={sending}
          now={now}
        />
      ) : op.waiting > 0 ? (
        <Tracejado
          icon={<MegaphoneIcon className="size-5" aria-hidden />}
          title="Estação livre"
          text={op.waiting === 1 ? "1 pessoa aguardando na unidade." : `${op.waiting} pessoas aguardando na unidade.`}
          action={
            <Button icon={MegaphoneIcon} disabled={sending} onClick={() => onCommand("call")}>
              Chamar o próximo
            </Button>
          }
        />
      ) : (
        <Tracejado
          icon={<UsersIcon className="size-5" aria-hidden />}
          title="Ninguém aguardando agora"
          text={
            op.remote > 0
              ? `${op.remote} a caminho. Quando chegar, o botão acende.`
              : "Quando alguém chegar, o botão acende."
          }
          action={
            <Button icon={MegaphoneIcon} disabled>
              Chamar o próximo
            </Button>
          }
        />
      )}
    </div>
  );
}

function Called({
  op,
  called,
  triage,
  color,
  onChooseColor,
  onCommand,
  sending,
  now,
}: Props & { called: NonNullable<StationOperation["called"]>; triage: boolean }) {
  const phase = calledPhase(called);
  const form = called.triage;
  // Sem a ficha da triagem não há cores na tela: a cor não pode travar o finalizar.
  const needsColor = needsClassify(op.station.stage, Boolean(form), color);
  return (
    <>
      <section
        aria-label="Paciente da estação"
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-b-4 border-[var(--ds-line)] bg-white px-5 py-4"
      >
        <div className="flex items-center gap-5">
          <span className="font-mono text-5xl font-black tracking-tight text-primary">{called.ticket}</span>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {phase === "called" ? "chamado, esperando entrar" : "na sua sala"}
            </span>
            <span className="text-lg font-extrabold text-slate-900">{called.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {phase === "called" ? (
                <Pill
                  tone={called.toleranceExceeded ? "late" : "neutral"}
                  icon={<ClockIcon className={ICON} aria-hidden />}
                >
                  <span className="tabular-nums">{stopwatch(called.calledAt, now)}</span> desde a chamada
                  {called.toleranceExceeded ? <span>, passou a tolerância</span> : null}
                </Pill>
              ) : (
                <Pill tone="room" icon={<CheckIcon className={ICON} aria-hidden />}>
                  na sua sala há{" "}
                  <span className="tabular-nums">{stopwatch(called.showedUpAt ?? called.calledAt, now)}</span>
                </Pill>
              )}
              {called.priority.map((g) => (
                <Pill key={g} icon={<HeartIcon className={ICON} aria-hidden />}>
                  {priorityText([g])}
                </Pill>
              ))}
              {called.skips > 0 ? (
                <Pill icon={<XIcon className={ICON} aria-hidden />}>
                  {called.skips === 1 ? "1 pulo" : `${called.skips} pulos`}
                </Pill>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === "called" ? (
            <>
              <Button variant="secondary" icon={MegaphoneIcon} disabled={sending} onClick={() => onCommand("recall")}>
                Rechamar
              </Button>
              <Button variant="outlineDanger" icon={XIcon} disabled={sending} onClick={() => onCommand("no-show")}>
                Não compareceu
              </Button>
              <Button icon={CheckIcon} disabled={sending} onClick={() => onCommand("showed-up")}>
                Compareceu
              </Button>
            </>
          ) : (
            <Button variant="text" disabled={sending} onClick={() => onCommand("undo-showed-up")}>
              desfazer
            </Button>
          )}
        </div>
      </section>

      {triage && form?.support ? (
        <p role="alert" className="flex gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-900">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <strong>Atenção:</strong> respondeu no app que tem pensamentos de tirar a própria vida ou de se machucar.
            Acolha agora. <strong>CVV 188</strong>, <strong>SAMU 192</strong>.
          </span>
        </p>
      ) : null}

      {phase === "called" ? (
        triage ? (
          <Tracejado
            icon={<CheckIcon className="size-5" aria-hidden />}
            title="A classificação de risco abre quando a pessoa entrar na sala (Compareceu)."
          />
        ) : null
      ) : (
        <section
          aria-label="Fechar o atendimento"
          className="flex flex-col gap-3 rounded-2xl border border-[var(--ds-line)] bg-white p-4"
        >
          {triage && form ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 font-extrabold text-slate-900">Classifique o risco</legend>
              <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 xl:grid-cols-5">
                {TRIAGE_COLORS.map((c) => (
                  <RiskCard
                    key={c.level}
                    color={c}
                    selected={color === c.level}
                    suggested={c.level === form.suggestedRisk}
                    onClick={() => onChooseColor(c.level)}
                  />
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-slate-600">
                <SmartphoneIcon className={ICON} aria-hidden />o app sugeriu{" "}
                {levelColor(form.suggestedRisk).label.toLowerCase()} porque:{" "}
                {form.rule.charAt(0).toLowerCase() + form.rule.slice(1)}
              </p>
            </fieldset>
          ) : null}
          {triage && canRefer(color) ? (
            <p className="flex gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              Vermelho: ao finalizar, a pessoa vai para o 1º lugar do atendimento desta unidade. Se ela precisa ir para
              outro serviço, encaminhe.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {triage && canRefer(color) ? (
                <Button
                  variant="danger"
                  icon={ArrowRightIcon}
                  disabled={sending}
                  onClick={() => onCommand("finish", true)}
                >
                  Encaminhar à emergência
                </Button>
              ) : needsColor ? (
                <p className="text-sm text-slate-600">Escolha a cor para finalizar.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="text"
                icon={PauseIcon}
                disabled={sending || needsColor}
                onClick={() => onCommand("finish")}
              >
                só finalizar
              </Button>
              <Button icon={CheckIcon} disabled={sending || needsColor} onClick={() => onCommand("call")}>
                Finalizar e chamar o próximo
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
