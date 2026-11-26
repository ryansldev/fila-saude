"use client";

import type { Service as ServiceSchema } from "@fila-saude/schemas/service";
import type { Session } from "@fila-saude/schemas/session";

import { sessionEditSchema, sessionInputSchema, visibilityInputSchema } from "@fila-saude/schemas/session";
import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import {
  Bookings,
  Choice,
  DataTable,
  FormField,
  Notice,
  NumberField,
  Section,
  Selection,
  SidePanel,
  SwitchField,
  Text,
} from "@/components/form";
import { PageHeader, RowActions, SessionState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { errorMessage, type SendingErrors, sendingErrors, validateClient } from "@/lib/forms/errors";
import {
  adjustVisibility,
  allowedVisibilities,
  type BandInput,
  bandsForSending,
  bandsText,
  readSlots,
  serviceStations,
  sessionsOfDayPath,
  todayInTimeZone,
  type Visibility,
  validDay,
} from "@/lib/forms/session";
import { useList } from "@/lib/use-list";

// Os tipos do contrato: estado da sessão e modo do serviço são os enums do schema, não strings soltas.
type Service = Pick<ServiceSchema, "id" | "name" | "mode">;
type Station = { id: string; name: string; stage: "triage" | "care"; services: string[] };

const WITHOUT_ERRORS: SendingErrors = { general: null, fields: {} };

/** Vagas do formulário: "sem limite" ligado vale null; desligado precisa de um inteiro ≥ 1. */
function formSlots(
  withoutLimit: boolean,
  text: string,
): { ok: true; slots: number | null } | { ok: false; error: string } {
  if (withoutLimit) return { ok: true, slots: null };
  if (!text.trim()) return { ok: false, error: 'Informe quantas vagas, ou ligue "Sem limite de vagas".' };
  const read = readSlots(text);
  return read.ok ? read : { ok: false, error: "Use 1 vaga ou mais." };
}

const VISIBILITIES: Record<Visibility, { label: string; description: string }> = {
  public: { label: "Pública", description: "Aparece na agenda do app; qualquer pessoa se inscreve" },
  private: { label: "Privada", description: "Só pela lista de espera da unidade" },
};

function visibilityOptions(allowed: Visibility[]) {
  return (Object.keys(VISIBILITIES) as Visibility[]).map((p) => ({
    value: p,
    ...VISIBILITIES[p],
    disabled: !allowed.includes(p),
  }));
}

const REGULATED_HINT = "Serviço regulado: a vaga vem da central de regulação, então a sessão é sempre privada.";

/** "Sem limite de vagas" e, desligado, o número de vagas. */
function SlotField({
  withoutLimit,
  slots,
  error,
  onChange,
}: {
  withoutLimit: boolean;
  slots: string;
  error?: string | undefined;
  onChange: (m: { withoutLimit: boolean; slots: string }) => void;
}) {
  return (
    <>
      <SwitchField
        label="Sem limite de vagas"
        description="A sessão aceita pacientes até o fim do horário."
        checked={withoutLimit}
        onChange={(checked) => onChange({ withoutLimit: checked, slots })}
      />
      {withoutLimit ? (
        error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null
      ) : (
        <FormField label="Quantidade" error={error} className="w-auto">
          <NumberField suffix="vagas" value={slots} onChange={(text) => onChange({ withoutLimit, slots: text })} />
        </FormField>
      )}
    </>
  );
}

/**
 * RN-SES-06: o horário em faixas ("das 08:00 às 12:00" e "das 13:00 às 17:00"); o vão entre duas faixas é o
 * intervalo, em que nenhuma estação chama.
 */
function Bands({
  bands,
  error,
  onChange,
}: {
  bands: BandInput[];
  error: string | undefined;
  onChange: (bands: BandInput[]) => void;
}) {
  const swap = (i: number, part: keyof BandInput, hour: string) =>
    onChange(bands.map((b, k) => (k === i ? { ...b, [part]: hour } : b)));
  // A próxima faixa começa uma hora depois do fim da última (o almoço comum) e dura quatro.
  const next = (): BandInput => {
    const [h = 12, m = 0] = (bands.at(-1)?.end ?? "12:00").split(":").map(Number);
    const at = (plus: number) => `${String(Math.min(h + plus, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { start: at(1), end: at(5) };
  };
  return (
    <FormField label="Horário" error={error}>
      <div className="flex flex-col gap-2">
        {bands.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: faixas editáveis sem id próprio
          <div key={i} className="flex items-center gap-2">
            <Text
              type="time"
              required
              aria-label={`Início do horário ${i + 1}`}
              className="w-28"
              value={b.start}
              onChange={(hour) => swap(i, "start", hour)}
            />
            <span className="text-sm text-slate-500">às</span>
            <Text
              type="time"
              required
              aria-label={`Fim do horário ${i + 1}`}
              className="w-28"
              value={b.end}
              onChange={(hour) => swap(i, "end", hour)}
            />
            {bands.length > 1 ? (
              <Button
                type="button"
                variant="text"
                size="icon"
                aria-label={`Remover o horário ${i + 1}`}
                title="Remover horário"
                onClick={() => onChange(bands.filter((_, k) => k !== i))}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="compact"
          className="self-start"
          onClick={() => onChange([...bands, next()])}
        >
          <PlusIcon data-icon="inline-start" />
          Adicionar horário
        </Button>
        {bands.length > 1 ? (
          <p className="text-sm text-slate-500">No intervalo entre os horários, nenhuma estação chama.</p>
        ) : null}
      </div>
    </FormField>
  );
}

type NewValues = {
  serviceId: string;
  /** RN-SES-06: as faixas do horário; o vão entre duas é o intervalo da sessão. */
  bands: BandInput[];
  withoutLimit: boolean;
  slots: string;
  visibility: Visibility;
  waivesPreRegistration: boolean;
  professional: string;
  stations: string[];
};

const NEW: NewValues = {
  serviceId: "",
  bands: [{ start: "08:00", end: "12:00" }],
  withoutLimit: true,
  slots: "",
  visibility: "private",
  waivesPreRegistration: false,
  professional: "",
  stations: [],
};

function NewSessionPanel({
  open,
  onClose,
  day,
  timeZone,
  services,
  stations,
  send,
}: {
  open: boolean;
  onClose: () => void;
  day: string;
  timeZone: string;
  services: Service[];
  stations: Station[];
  send: (body: unknown) => Promise<void>;
}) {
  const [v, setV] = useState(NEW);
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (open) {
      setV(NEW);
      setErrors(WITHOUT_ERRORS);
    }
  }, [open]);

  const service = services.find((s) => s.id === v.serviceId);
  const allowed = allowedVisibilities(service?.mode ?? "direct");
  const fromSession = serviceStations(stations, v.serviceId);

  async function onSend() {
    const slots = formSlots(v.withoutLimit, v.slots);
    if (!slots.ok) return setErrors({ general: null, fields: { slots: slots.error } });
    const time = bandsForSending(day, v.bands, timeZone);
    if (!time.ok) return setErrors({ general: null, fields: { breaks: time.error } });
    const body = {
      serviceId: v.serviceId,
      start: time.start,
      end: time.end,
      breaks: time.breaks,
      slots: slots.slots,
      visibility: v.visibility,
      waivesPreRegistration: v.visibility === "public" && v.waivesPreRegistration,
      professional: v.professional.trim() || null,
      stations: v.stations,
    };
    const invalid = validateClient(sessionInputSchema, body);
    if (invalid) return setErrors(invalid);
    setSending(true);
    try {
      await send(body);
      onClose();
    } catch (err) {
      setErrors(sendingErrors(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={`Nova sessão em ${day.split("-").reverse().join("/")}`}
      description="Um horário de atendimento de um serviço, com as vagas e quem pode se inscrever."
      onSend={onSend}
      action="Criar sessão"
      sending={sending}
    >
      <Section title="Serviço e horário">
        <FormField label="Serviço" error={errors.fields.serviceId}>
          <Selection
            value={v.serviceId}
            placeholder="Escolha o serviço"
            options={services.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(serviceId) => {
              const fresh = services.find((s) => s.id === serviceId);
              const vis = allowedVisibilities(fresh?.mode ?? "direct").includes(v.visibility)
                ? v.visibility
                : "private";
              setV({ ...v, serviceId, stations: [], ...adjustVisibility(v, vis) });
            }}
          />
        </FormField>
        <Bands
          bands={v.bands}
          error={errors.fields.breaks ?? errors.fields.start ?? errors.fields.end}
          onChange={(bands) => setV({ ...v, bands })}
        />
      </Section>
      <Section title="Vagas">
        <SlotField
          withoutLimit={v.withoutLimit}
          slots={v.slots}
          error={errors.fields.slots}
          onChange={(m) => setV({ ...v, ...m })}
        />
      </Section>
      <Section title="Quem vê esta sessão" description={allowed.includes("public") ? undefined : REGULATED_HINT}>
        <Choice
          value={v.visibility}
          onChange={(vis) => setV({ ...v, ...adjustVisibility(v, vis as Visibility) })}
          options={visibilityOptions(allowed)}
        />
        {errors.fields.visibility ? <p className="text-sm text-destructive">{errors.fields.visibility}</p> : null}
        {v.visibility === "public" ? (
          <SwitchField
            label="Dispensar pré-cadastro"
            description="O paciente se inscreve sem ter feito o pré-cadastro na unidade."
            checked={v.waivesPreRegistration}
            onChange={(waivesPreRegistration) => setV({ ...v, waivesPreRegistration })}
          />
        ) : null}
        {errors.fields.waivesPreRegistration ? (
          <p className="text-sm text-destructive">{errors.fields.waivesPreRegistration}</p>
        ) : null}
      </Section>
      <Section title="Profissional" description="Opcional. Aparece para o paciente junto do horário.">
        <FormField label="Nome do profissional" error={errors.fields.professional}>
          <Text
            placeholder="Ex.: Dra. Ana Souza"
            value={v.professional}
            onChange={(professional) => setV({ ...v, professional })}
          />
        </FormField>
      </Section>
      <Section title="Estações" description="As salas que chamam os pacientes desta sessão.">
        <Bookings
          values={v.stations}
          onChange={(checked) => setV({ ...v, stations: checked })}
          options={fromSession.map((e) => ({
            value: e.id,
            label: e.name,
            description: e.stage === "triage" ? "Triagem" : "Atendimento",
          }))}
          empty={
            v.serviceId
              ? "Nenhuma estação atende este serviço. Cadastre uma em Estações."
              : "Escolha o serviço primeiro para ver as estações que o atendem."
          }
        />
        {errors.fields.stations ? <p className="text-sm text-destructive">{errors.fields.stations}</p> : null}
      </Section>
      <Notice text={errors.general} />
    </SidePanel>
  );
}

type EditValues = {
  withoutLimit: boolean;
  slots: string;
  visibility: Visibility;
  waivesPreRegistration: boolean;
  professional: string;
};

function fromSession(s: Session): EditValues {
  return {
    withoutLimit: s.slots === null,
    slots: s.slots === null ? "" : String(s.slots),
    visibility: s.visibility,
    waivesPreRegistration: s.waivesPreRegistration,
    professional: s.professional ?? "",
  };
}

function PanelEditSession({
  session,
  onClose,
  title,
  services,
  cancel,
  onSave,
}: {
  session: Session | null;
  onClose: () => void;
  title: string;
  services: Service[];
  cancel: (s: Session) => Promise<boolean>;
  onSave: () => void;
}) {
  const api = useApi();
  const [v, setV] = useState<EditValues | null>(null);
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [sending, setSending] = useState(false);
  // Versão já gravada nesta abertura (a edição passou e a visibilidade falhou).
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao abrir outra sessão.
  useEffect(() => {
    if (session) {
      setV(fromSession(session));
      setErrors(WITHOUT_ERRORS);
      setSavedVersion(null);
    }
  }, [session?.id]);

  const allowed = allowedVisibilities(services.find((x) => x.id === session?.serviceId)?.mode ?? "direct");
  // A visibilidade só muda enquanto a sessão não terminou (mesma regra de antes).
  const changesVisibility = session?.state === "planned" || session?.state === "open";

  async function onSend() {
    if (!session || !v) return;
    const slots = formSlots(v.withoutLimit, v.slots);
    if (!slots.ok) return setErrors({ general: null, fields: { slots: slots.error } });
    const professional = v.professional.trim() || null;
    // Só vai o que mudou; `versao` é a trava otimista.
    const edit: { slots?: number | null; professional?: string | null } = {};
    if (slots.slots !== session.slots) edit.slots = slots.slots;
    if (professional !== session.professional) edit.professional = professional;
    const waives = v.visibility === "public" && v.waivesPreRegistration;
    const changedVisibility =
      changesVisibility && (v.visibility !== session.visibility || waives !== session.waivesPreRegistration);

    const hasEdit = Object.keys(edit).length > 0;
    if (hasEdit) {
      const invalid = validateClient(sessionEditSchema, { ...edit, version: session.version });
      if (invalid) return setErrors(invalid);
    }
    if (changedVisibility) {
      const invalid = validateClient(visibilityInputSchema, {
        visibility: v.visibility,
        waivesPreRegistration: waives,
        version: session.version,
      });
      if (invalid) return setErrors(invalid);
    }
    if (!hasEdit && !changedVisibility) return onClose();

    setSending(true);
    // A edição e a visibilidade são dois pedidos: se só o segundo falha, o primeiro já valeu. A versão
    // nova fica guardada para o próximo "Salvar" e a lista recarrega com o que mudou.
    let version = savedVersion ?? session.version;
    let edited = false;
    try {
      if (hasEdit) {
        const saved = await api.patch<Session>(`/v1/panel/sessions/${session.id}`, { ...edit, version });
        version = saved.version;
        edited = true;
        setSavedVersion(saved.version);
      }
      if (changedVisibility) {
        await api.post(`/v1/panel/sessions/${session.id}/visibility`, {
          visibility: v.visibility,
          waivesPreRegistration: waives,
          version,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      if (edited) onSave();
      setErrors(sendingErrors(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <SidePanel
      open={session !== null}
      onClose={onClose}
      title="Editar sessão"
      description={title}
      onSend={onSend}
      action="Salvar"
      sending={sending}
      {...(session?.state === "planned"
        ? {
            danger: {
              label: "Cancelar sessão",
              onClick: async () => {
                if (await cancel(session)) onClose();
              },
            },
          }
        : {})}
    >
      {v ? (
        <>
          <Section title="Vagas">
            <SlotField
              withoutLimit={v.withoutLimit}
              slots={v.slots}
              error={errors.fields.slots}
              onChange={(m) => setV({ ...v, ...m })}
            />
          </Section>
          {changesVisibility ? (
            <Section title="Quem vê esta sessão" description={allowed.includes("public") ? undefined : REGULATED_HINT}>
              <Choice
                value={v.visibility}
                onChange={(vis) => setV({ ...v, ...adjustVisibility(v, vis as Visibility) })}
                options={visibilityOptions(
                  // Já pública num serviço que virou regulado: deixa ficar como está.
                  session?.visibility === "public" ? [...allowed, "public"] : allowed,
                )}
              />
              {errors.fields.visibility ? <p className="text-sm text-destructive">{errors.fields.visibility}</p> : null}
              {v.visibility === "public" ? (
                <SwitchField
                  label="Dispensar pré-cadastro"
                  description="O paciente se inscreve sem ter feito o pré-cadastro na unidade."
                  checked={v.waivesPreRegistration}
                  onChange={(waivesPreRegistration) => setV({ ...v, waivesPreRegistration })}
                />
              ) : null}
              {errors.fields.waivesPreRegistration ? (
                <p className="text-sm text-destructive">{errors.fields.waivesPreRegistration}</p>
              ) : null}
            </Section>
          ) : null}
          <Section title="Profissional" description="Opcional. Aparece para o paciente junto do horário.">
            <FormField label="Nome do profissional" error={errors.fields.professional}>
              <Text
                placeholder="Ex.: Dra. Ana Souza"
                value={v.professional}
                onChange={(professional) => setV({ ...v, professional })}
              />
            </FormField>
          </Section>
          <Notice text={errors.general} />
        </>
      ) : null}
    </SidePanel>
  );
}

export default function Sessions() {
  const api = useApi();
  const confirm = useConfirm();
  const { current, unit } = useCurrentUnit(["configure_services_sessions_stations_tv"]);
  const timeZone = unit?.timeZone ?? "America/Sao_Paulo";
  const [day, setDay] = useState(() => todayInTimeZone("America/Sao_Paulo"));
  // O dia padrão segue o fuso da unidade (Acre e Amazonas viram o dia antes de Brasília).
  const dayTimeZone = unit?.timeZone;
  useEffect(() => {
    if (dayTimeZone) setDay(todayInTimeZone(dayTimeZone));
  }, [dayTimeZone]);
  const sessions = useList<Session>(current ? sessionsOfDayPath(current, day, timeZone) : null);
  const { items: services } = useList<Service>(current ? `/v1/panel/units/${current}/services` : null);
  const { items: stations } = useList<Station>(current ? `/v1/panel/units/${current}/stations` : null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  // Trocou de unidade: fecha os painéis e limpa os avisos da anterior.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao trocar de unidade.
  useEffect(() => {
    setCreating(false);
    setEditing(null);
    setNotice(null);
    setOk(null);
  }, [current]);

  const name = (id: string, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? "?";
  const time = (s: Session) => bandsText(s, timeZone).join(" e ");

  async function cancel(s: Session): Promise<boolean> {
    const yes = await confirm({
      title: "Cancelar esta sessão?",
      description: `${name(s.serviceId, services)}, ${time(s)}.`,
      action: "Cancelar sessão",
      danger: true,
    });
    if (!yes) return false;
    try {
      await api.post(`/v1/panel/sessions/${s.id}/cancel`, {});
      setNotice(null);
      setOk(`Sessão das ${time(s)} cancelada.`);
      sessions.reload();
      return true;
    } catch (err) {
      setNotice(errorMessage(err));
      return false;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Sessões"
        description="Os horários de atendimento de cada dia, com vagas e se aparecem na agenda do app."
        actions={
          current ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Adicionar sessão
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <FormField label="Dia" className="w-full sm:w-52">
          <Text type="date" value={day} onChange={(fresh) => validDay(fresh) && setDay(fresh)} />
        </FormField>
      </div>
      <Notice text={sessions.error ?? notice} />
      <Notice text={ok} kind="ok" />
      {current ? (
        <DataTable header={["Horário", "Serviço", "Vagas", "Visibilidade", "Profissional", "Estado", ""]}>
          {sessions.items.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-semibold text-slate-900">
                {bandsText(s, timeZone).map((b) => (
                  <span key={b} className="block">
                    {b}
                  </span>
                ))}
              </TableCell>
              <TableCell>{name(s.serviceId, services)}</TableCell>
              <TableCell>{s.slots === null ? `${s.taken} / sem limite` : `${s.taken} / ${s.slots}`}</TableCell>
              <TableCell>
                {VISIBILITIES[s.visibility].label}
                {s.waivesPreRegistration ? " · sem pré-cadastro" : ""}
              </TableCell>
              <TableCell>{s.professional ?? "—"}</TableCell>
              <TableCell>
                <SessionState state={s.state} />
              </TableCell>
              <TableCell>
                <RowActions
                  {...(s.state === "planned"
                    ? { exclude: { label: "Cancelar sessão", onClick: () => void cancel(s) } }
                    : {})}
                  {...(s.state === "planned" || s.state === "open"
                    ? { edit: { label: "Editar sessão", onClick: () => setEditing(s) } }
                    : {})}
                />
              </TableCell>
            </TableRow>
          ))}
          {sessions.items.length === 0 && !sessions.error ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                Nenhuma sessão neste dia. Use "Adicionar sessão".
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
      <NewSessionPanel
        open={creating}
        onClose={() => setCreating(false)}
        day={day}
        timeZone={timeZone}
        services={services}
        stations={stations}
        send={async (body) => {
          await api.post(`/v1/panel/units/${current}/sessions`, body);
          setNotice(null);
          setOk("Sessão criada.");
          sessions.reload();
        }}
      />
      <PanelEditSession
        session={editing}
        onClose={() => setEditing(null)}
        title={editing ? `${name(editing.serviceId, services)}, ${time(editing)}.` : ""}
        services={services}
        cancel={cancel}
        onSave={() => {
          setNotice(null);
          setOk("Sessão salva.");
          sessions.reload();
        }}
      />
    </div>
  );
}
