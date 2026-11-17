"use client";

import { serviceEditSchema, serviceInputSchema } from "@fila-saude/schemas/service";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ZodType } from "zod";
import {
  Choice,
  DataTable,
  FormField,
  Notice,
  NumberField,
  Section,
  SidePanel,
  SwitchField,
  Text,
} from "@/components/form";
import { PageHeader, RowActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { type SendingErrors, sendingErrors, validateClient } from "@/lib/forms/errors";
import {
  averageTimeText,
  MINUTES_FIELD,
  type Mode,
  type ServiceValues,
  serviceForSending,
  showsTriageTime,
} from "@/lib/forms/service";
import { useList } from "@/lib/use-list";

type Service = {
  id: string;
  name: string;
  prefix: string;
  requiresTriage: boolean;
  mode: Mode;
  averageTimeMin: { triage?: number; care?: number };
};

const EMPTY: ServiceValues = {
  name: "",
  prefix: "",
  requiresTriage: false,
  mode: "direct",
  triage: "5",
  care: "15",
};
const WITHOUT_ERRORS: SendingErrors = { general: null, fields: {} };
const ERROR_MINUTES = "Use um número inteiro de minutos.";

/** Minutos digitados: vazio vale (não vai), senão só dígitos; assim nunca vai NaN para a API. */
function problemsOfMinutes(v: ServiceValues): Record<string, string> {
  const invalid = (t: string) => t.trim() !== "" && !/^\d+$/.test(t.trim());
  const fields: Record<string, string> = {};
  if (showsTriageTime(v.requiresTriage) && invalid(v.triage)) fields[MINUTES_FIELD.triage] = ERROR_MINUTES;
  if (invalid(v.care)) fields[MINUTES_FIELD.care] = ERROR_MINUTES;
  return fields;
}

function fromService(s: Service): ServiceValues {
  return {
    name: s.name,
    prefix: s.prefix,
    requiresTriage: s.requiresTriage,
    mode: s.mode,
    triage: String(s.averageTimeMin.triage ?? ""),
    care: String(s.averageTimeMin.care ?? ""),
  };
}

const MODE_DESCRIPTION: Record<Mode, { label: string; description: string }> = {
  direct: { label: "Livre", description: "O paciente entra na lista de espera pelo app ou pela recepção." },
  referral: { label: "Com requisição", description: "Precisa de pedido médico, conferido pela unidade." },
  regulated: { label: "Regulado", description: "A vaga vem da central de regulação; não aparece na agenda do app." },
};

/** Cadastro ou edição de um serviço, num painel lateral em três seções. */
function ServicePanel({
  open,
  onClose,
  title,
  action,
  initial,
  schema,
  send,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  action: string;
  initial: ServiceValues;
  /** O mesmo schema da rota da API que recebe o envio. */
  schema: ZodType;
  send: (v: ServiceValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [sending, setSending] = useState(false);
  // Reabriu (outro serviço ou novo cadastro): começa do valor inicial, sem erros antigos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao abrir.
  useEffect(() => {
    if (open) {
      setV(initial);
      setErrors(WITHOUT_ERRORS);
    }
  }, [open]);

  async function onSend() {
    const minutes = problemsOfMinutes(v);
    if (Object.keys(minutes).length > 0) return setErrors({ general: null, fields: minutes });
    const invalid = validateClient(schema, serviceForSending(v));
    if (invalid) return setErrors(invalid);
    setSending(true);
    try {
      await send(v);
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
      title={title}
      description="O que a unidade atende e como a fila desse serviço funciona."
      onSend={onSend}
      action={action}
      sending={sending}
    >
      <Section title="Identificação" description="Como o serviço aparece no app, no painel e na senha da TV.">
        <FormField label="Nome" error={errors.fields.name}>
          <Text required placeholder="Ex.: Clínico geral" value={v.name} onChange={(name) => setV({ ...v, name })} />
        </FormField>
        <FormField
          label="Prefixo da senha"
          error={errors.fields.prefix}
          hint={`1 a 3 letras. A senha fica ${v.prefix || "C"}-001.`}
          className="sm:w-80"
        >
          <Text
            required
            maxLength={3}
            placeholder="C"
            value={v.prefix}
            mask={(t) => t.toUpperCase().replace(/[^A-Z]/g, "")}
            onChange={(prefix) => setV({ ...v, prefix })}
          />
        </FormField>
      </Section>
      <Section title="Como o paciente consegue a vaga">
        <Choice
          columns={1}
          value={v.mode}
          onChange={(mode) => setV({ ...v, mode: mode as Mode })}
          options={(Object.keys(MODE_DESCRIPTION) as Mode[]).map((m) => ({ value: m, ...MODE_DESCRIPTION[m] }))}
        />
        {errors.fields.mode ? <p className="text-sm text-destructive">{errors.fields.mode}</p> : null}
      </Section>
      <Section
        title="Atendimento"
        description="O tempo médio é o ponto de partida da previsão no app; depois o sistema aprende com o dia."
      >
        <SwitchField
          label="Passa pela triagem"
          description="O enfermeiro chama primeiro e classifica o risco; depois o paciente vai para o atendimento."
          checked={v.requiresTriage}
          onChange={(requiresTriage) => setV({ ...v, requiresTriage })}
        />
        <div className="flex flex-wrap gap-4">
          {showsTriageTime(v.requiresTriage) ? (
            <FormField label="Tempo médio da triagem" error={errors.fields[MINUTES_FIELD.triage]} className="w-auto">
              <NumberField suffix="min" value={v.triage} onChange={(triage) => setV({ ...v, triage })} maxDigits={3} />
            </FormField>
          ) : null}
          <FormField label="Tempo médio do atendimento" error={errors.fields[MINUTES_FIELD.care]} className="w-auto">
            <NumberField suffix="min" value={v.care} onChange={(care) => setV({ ...v, care })} maxDigits={3} />
          </FormField>
        </div>
      </Section>
      <Notice text={errors.general} />
    </SidePanel>
  );
}

export default function Services() {
  const api = useApi();
  const { current } = useCurrentUnit(["configure_services_sessions_stations_tv"]);
  const { items, error, reload } = useList<Service>(current ? `/v1/panel/units/${current}/services` : null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Serviços"
        description="O que cada unidade atende, com o prefixo da senha e o tempo médio de atendimento."
        actions={
          current ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Adicionar serviço
            </Button>
          ) : null
        }
      />
      <Notice text={error} />
      <Notice text={ok} kind="ok" />
      {current ? (
        <DataTable header={["Senha", "Nome", "Marcação", "Triagem", "Tempo médio", ""]}>
          {items.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-700">
                  {s.prefix}
                </span>
              </TableCell>
              <TableCell className="font-semibold text-slate-900">{s.name}</TableCell>
              <TableCell>{MODE_DESCRIPTION[s.mode].label}</TableCell>
              <TableCell>{s.requiresTriage ? "Sim" : "Não"}</TableCell>
              <TableCell>{averageTimeText(s.averageTimeMin)}</TableCell>
              <TableCell>
                <RowActions edit={{ label: `Editar ${s.name}`, onClick: () => setEditing(s) }} />
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && !error ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                Nenhum serviço nesta unidade. Use "Adicionar serviço".
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
      <ServicePanel
        open={creating}
        onClose={() => setCreating(false)}
        title="Adicionar serviço"
        action="Criar serviço"
        initial={EMPTY}
        schema={serviceInputSchema}
        send={async (v) => {
          await api.post(`/v1/panel/units/${current}/services`, serviceForSending(v));
          setOk(`Serviço ${v.name.trim()} criado.`);
          reload();
        }}
      />
      <ServicePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Editar ${editing?.name ?? "serviço"}`}
        action="Salvar"
        initial={editing ? fromService(editing) : EMPTY}
        schema={serviceEditSchema}
        send={async (v) => {
          if (!editing) return;
          await api.patch(`/v1/panel/services/${editing.id}`, serviceForSending(v));
          setOk(`Serviço ${v.name.trim()} salvo.`);
          reload();
        }}
      />
    </div>
  );
}
