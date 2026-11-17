"use client";

import { maskPostalCode, onlyDigits } from "@fila-saude/schemas/masks";
import { unitEditSchema, unitInputSchema } from "@fila-saude/schemas/unit";
import { PlusIcon } from "lucide-react";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import {
  Choice,
  DataTable,
  FormField,
  Notice,
  NumberField,
  Section,
  Selection,
  SidePanel,
  Text,
} from "@/components/form";
import { PageHeader, RowActions } from "@/components/page";
import { TimeEditor } from "@/components/time-editor";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { errorMessage, type SendingErrors, sendingErrors, validateClient } from "@/lib/forms/errors";
import { DEFAULT_TIME, type Time, timeProblems, timeSummary } from "@/lib/forms/time";
import { timeZoneOptions } from "@/lib/forms/time-zones";
import { CONFIG_FIELDS, configForSending, type EffectiveConfig, inheritedField } from "@/lib/forms/unit";
import { useList } from "@/lib/use-list";

type Unit = {
  id: string;
  name: string;
  kind: string;
  cnes: string | null;
  address: Address;
  timeZone: string;
  time: Time;
  config: Record<string, unknown>;
};

type Address = { postalCode: string; street: string; number: string; complement: string | null; neighborhood: string };

const EMPTY = {
  name: "",
  kind: "ubs",
  cnes: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  timeZone: "America/Sao_Paulo",
};

function textAddress(e: Address) {
  const postalCode = e.postalCode.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return `${e.street}, ${e.number}${e.complement ? ` (${e.complement})` : ""} · ${e.neighborhood} · ${postalCode}`;
}

const WITHOUT_ERRORS: SendingErrors = { general: null, fields: {} };
const KINDS = [
  { value: "ubs", label: "UBS", description: "Atenção básica: consultas, vacinas e acompanhamento." },
  { value: "policlinica", label: "Policlínica", description: "Especialidades e exames, em geral com encaminhamento." },
  { value: "upa", label: "UPA", description: "Urgência e emergência, aberta por mais horas." },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((t) => [t.value, t.label]));

/** Rótulo sem a unidade entre parênteses: ela vai como sufixo do campo. */
const RULES: Record<(typeof CONFIG_FIELDS)[number]["field"], { label: string; suffix: string }> = {
  windowK: { label: "Janela de chamada (K)", suffix: "pessoas" },
  toleranceMin: { label: "Tolerância", suffix: "min" },
  leaveHomeMin: { label: 'Aviso "saia de casa"', suffix: "min" },
  confirmationDeadlineHours: { label: "Prazo de confirmação", suffix: "h" },
};
const withUppercase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Cadastro de unidade num painel lateral: identificação, endereço, fuso e horário. */
function NewUnit({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const api = useApi();
  const [v, setV] = useState(EMPTY);
  const [time, setTime] = useState<Time>(DEFAULT_TIME);
  const timeZones = useMemo(() => timeZoneOptions(), []);
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [sending, setSending] = useState(false);
  // Reabriu: sem erros antigos.
  useEffect(() => {
    if (open) setErrors(WITHOUT_ERRORS);
  }, [open]);

  async function send() {
    const problems = timeProblems(time);
    if (Object.keys(problems).length > 0) return setErrors({ general: null, fields: problems });
    const body = {
      name: v.name,
      kind: v.kind,
      cnes: v.cnes.trim() || null,
      address: {
        postalCode: v.postalCode,
        street: v.street,
        number: v.number,
        complement: v.complement.trim() || null,
        neighborhood: v.neighborhood,
      },
      timeZone: v.timeZone,
      time,
    };
    const invalid = validateClient(unitInputSchema, body);
    if (invalid) return setErrors(invalid);
    setSending(true);
    try {
      await api.post("/v1/panel/units", body);
      setErrors(WITHOUT_ERRORS);
      setV({ ...EMPTY, kind: v.kind, timeZone: v.timeZone });
      setTime(DEFAULT_TIME);
      onCreate(v.name);
    } catch (err) {
      setErrors(sendingErrors(err));
    } finally {
      setSending(false);
    }
  }

  // Máscara por campo: CEP com traço e CNES só com dígitos, enquanto digita.
  const MASK: Partial<Record<keyof typeof EMPTY, (t: string) => string>> = {
    postalCode: maskPostalCode,
    cnes: (t) => onlyDigits(t).slice(0, 7),
  };
  const text = (k: keyof typeof EMPTY, extra: Omit<ComponentProps<typeof Text>, "value" | "onChange"> = {}) => (
    <Text value={v[k]} mask={MASK[k]} onChange={(t) => setV({ ...v, [k]: t })} {...extra} />
  );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Adicionar unidade"
      description="As regras da fila vêm do município; dá para ajustar depois, em Configurar."
      onSend={send}
      action="Criar unidade"
      sending={sending}
    >
      <Section title="Identificação" description="Como a unidade aparece no app e no painel.">
        <FormField label="Nome" error={errors.fields.name}>
          {text("name", { required: true, placeholder: "Ex.: UBS Centro" })}
        </FormField>
        <FormField label="Tipo" error={errors.fields.kind}>
          <Choice columns={3} value={v.kind} options={KINDS} onChange={(kind) => setV({ ...v, kind })} />
        </FormField>
        <FormField
          label="Código CNES (opcional)"
          error={errors.fields.cnes}
          hint="7 dígitos, do cadastro nacional de estabelecimentos."
          className="sm:w-60"
        >
          {text("cnes", { inputMode: "numeric", maxLength: 7, placeholder: "0000000" })}
        </FormField>
      </Section>
      <Section title="Endereço" description="Cidade e estado vêm do município.">
        <div className="grid gap-x-5 gap-y-5 sm:grid-cols-[10rem_1fr]">
          <FormField label="CEP" error={errors.fields["address.postalCode"]}>
            {text("postalCode", { inputMode: "numeric", required: true, maxLength: 9, placeholder: "00000-000" })}
          </FormField>
          <FormField label="Logradouro" error={errors.fields["address.street"]}>
            {text("street", { required: true, placeholder: "Rua, avenida…" })}
          </FormField>
          <FormField label="Número" error={errors.fields["address.number"]}>
            {text("number", { required: true, placeholder: "ou s/n" })}
          </FormField>
          <FormField label="Complemento" error={errors.fields["address.complement"]}>
            {text("complement", { placeholder: "Opcional" })}
          </FormField>
        </div>
        <FormField label="Bairro" error={errors.fields["address.neighborhood"]}>
          {text("neighborhood", { required: true })}
        </FormField>
      </Section>
      <Section title="Fuso e horário" description="Dias sem intervalo ficam fechados.">
        <FormField label="Fuso horário" error={errors.fields.timeZone} className="sm:w-80">
          <Selection
            value={v.timeZone}
            options={timeZones.map((f) => ({ value: f.timeZone, label: f.label }))}
            onChange={(timeZone) => setV({ ...v, timeZone })}
          />
        </FormField>
        <TimeEditor value={time} change={setTime} errors={errors.fields} />
      </Section>
      <Notice text={errors.general} />
    </SidePanel>
  );
}

/**
 * Horário e regras da fila de uma unidade, num só envio (o PATCH aceita os dois juntos).
 * Regra vazia = herda do município ou do padrão.
 */
function ConfigureUnit({ unit, onClose, onSave }: { unit: Unit; onClose: () => void; onSave: (name: string) => void }) {
  const api = useApi();
  const [time, setTime] = useState<Time>(unit.time);
  const [effective, setEffective] = useState<EffectiveConfig | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [readError, setReadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<EffectiveConfig>(`/v1/panel/units/${unit.id}/config`)
      .then((c) => {
        if (!active) return;
        setEffective(c);
        setReadError(null);
        setValues(
          Object.fromEntries(
            CONFIG_FIELDS.map(({ field }) => [field, c.origin[field] === "unit" ? String(c.values[field]) : ""]),
          ),
        );
      })
      .catch((e) => active && setReadError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [api, unit.id]);

  async function save() {
    const problems = timeProblems(time);
    if (Object.keys(problems).length > 0) return setErrors({ general: null, fields: problems });
    // Só inteiros (ou vazio = herdar): "1,5" ou "dez" viraria NaN no envio.
    const notIntegers = Object.fromEntries(
      Object.entries(values)
        .filter(([, t]) => t.trim() !== "" && !/^\d+$/.test(t.trim()))
        .map(([c]) => [`config.${c}`, "Use um número inteiro, ou deixe vazio para herdar."]),
    );
    if (Object.keys(notIntegers).length > 0) return setErrors({ general: null, fields: notIntegers });
    // Sem a config lida, só o horário vai (não dá para saber o que é próprio da unidade).
    const own = effective ? CONFIG_FIELDS.map((c) => c.field).filter((c) => inheritedField(effective, c).own) : [];
    const config = effective ? configForSending(values, own) : {};
    const body = Object.keys(config).length > 0 ? { time, config } : { time };
    const invalid = validateClient(unitEditSchema, body);
    if (invalid) return setErrors(invalid);
    setSending(true);
    try {
      await api.patch(`/v1/panel/units/${unit.id}`, body);
      setErrors(WITHOUT_ERRORS);
      onSave(unit.name);
    } catch (err) {
      setErrors(sendingErrors(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <SidePanel
      open
      onClose={onClose}
      title={`Configurar ${unit.name}`}
      description={textAddress(unit.address)}
      onSend={save}
      action="Salvar"
      sending={sending}
    >
      <Section title="Horário de funcionamento" description="Dias sem intervalo ficam fechados.">
        <TimeEditor value={time} change={setTime} errors={errors.fields} />
      </Section>
      <Section title="Regras da fila" description="Deixe vazio para seguir o valor do município ou do padrão.">
        {readError ? <Notice text={readError} /> : null}
        {effective ? (
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            {CONFIG_FIELDS.map(({ field }) => {
              const h = inheritedField(effective, field);
              const rule = RULES[field];
              return (
                <FormField
                  key={field}
                  label={rule.label}
                  error={errors.fields[`config.${field}`]}
                  hint={values[field] ? "Valor da unidade. Apague para herdar." : `${withUppercase(h.text)}.`}
                >
                  <NumberField
                    suffix={rule.suffix}
                    placeholder={String(h.value)}
                    value={values[field] ?? ""}
                    onChange={(t) => setValues({ ...values, [field]: t })}
                  />
                </FormField>
              );
            })}
          </div>
        ) : null}
      </Section>
      <Notice text={errors.general} />
    </SidePanel>
  );
}

export default function Units() {
  const api = useApi();
  const { items, error, reload } = useList<Unit>("/v1/panel/units");
  const [open, setOpen] = useState<string | null>(null);
  const selected = items.find((u) => u.id === open) ?? null;
  const [creating, setCreating] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const confirm = useConfirm();

  async function remove(u: Unit) {
    const ok = await confirm({
      title: `Remover a unidade ${u.name}?`,
      description: "A equipe perde o acesso a ela. O histórico fica guardado.",
      action: "Remover",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/v1/panel/units/${u.id}`);
      setNotice(null);
      if (open === u.id) setOpen(null);
      reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Unidades"
        description="As unidades de saúde do município, com endereço, horário e regras da fila."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
            Adicionar unidade
          </Button>
        }
      />
      <Notice text={error ?? notice} />
      <Notice text={ok} kind="ok" />
      <DataTable header={["Nome", "Tipo", "CNES", "Endereço", "Horário", ""]}>
        {items.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-semibold text-slate-900">{u.name}</TableCell>
            <TableCell>{KIND_LABEL[u.kind] ?? u.kind}</TableCell>
            <TableCell>{u.cnes ?? "—"}</TableCell>
            <TableCell className="whitespace-normal">{textAddress(u.address)}</TableCell>
            <TableCell className="whitespace-normal">{timeSummary(u.time)}</TableCell>
            <TableCell>
              <RowActions
                exclude={{ label: `Remover ${u.name}`, onClick: () => remove(u) }}
                edit={{ label: `Configurar ${u.name}`, onClick: () => setOpen(u.id) }}
              />
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && !error ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-slate-500">
              Nenhuma unidade ainda. Use "Adicionar unidade".
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
      {selected ? (
        <ConfigureUnit
          key={selected.id}
          unit={selected}
          onClose={() => setOpen(null)}
          onSave={(name) => {
            setOpen(null);
            setOk(`Unidade ${name} salva.`);
            reload();
          }}
        />
      ) : null}
      <NewUnit
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(name) => {
          setCreating(false);
          setOk(`Unidade ${name} criada.`);
          reload();
        }}
      />
    </div>
  );
}
