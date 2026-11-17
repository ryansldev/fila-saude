"use client";

import { stationEditSchema, stationInputSchema } from "@fila-saude/schemas/station";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import { Bookings, Choice, DataTable, FormField, Notice, Section, SidePanel, Text } from "@/components/form";
import { PageHeader, RowActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { errorMessage, type SendingErrors, sendingErrors, validateClient } from "@/lib/forms/errors";
import { servicesForStage } from "@/lib/forms/station";
import { useList } from "@/lib/use-list";

type Stage = "triage" | "care";
type Station = { id: string; name: string; stage: Stage; services: string[]; open: boolean };
type Service = { id: string; name: string; prefix: string; requiresTriage: boolean };
type StationValues = { name: string; stage: Stage; services: string[] };

const EMPTY: StationValues = { name: "", stage: "care", services: [] };
const WITHOUT_ERRORS: SendingErrors = { general: null, fields: {} };

const STAGES: Record<Stage, { label: string; description: string }> = {
  triage: { label: "Triagem", description: "Acolhimento e classificação de risco pelo enfermeiro" },
  care: { label: "Atendimento", description: "Consulta, curativo, procedimento" },
};

/** Cadastro (com etapa) ou edição (nome e serviços; a etapa não muda depois de criada). */
function StationPanel({
  open,
  onClose,
  title,
  action,
  initial,
  editing,
  services,
  send,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  action: string;
  initial: StationValues;
  /** Na edição a etapa fica travada e só vai o que mudou. */
  editing: boolean;
  services: Service[];
  send: (v: StationValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [sending, setSending] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao abrir.
  useEffect(() => {
    if (open) {
      setV(initial);
      setErrors(WITHOUT_ERRORS);
    }
  }, [open]);

  const offered = servicesForStage(services, v.stage);

  async function onSend() {
    setSending(true);
    try {
      await send(v);
      onClose();
    } catch (err) {
      setErrors(err instanceof LocalErrors ? err.errors : sendingErrors(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={title}
      description="Uma sala ou consultório que chama pacientes no painel e na TV."
      onSend={onSend}
      action={action}
      sending={sending}
    >
      <Section title="Identificação" description="O nome aparece na TV quando a estação chama alguém.">
        <FormField label="Nome" error={errors.fields.name}>
          <Text required placeholder="Ex.: Consultório 3" value={v.name} onChange={(name) => setV({ ...v, name })} />
        </FormField>
      </Section>
      <Section title="Etapa" description="Não muda depois de criada.">
        <Choice
          value={v.stage}
          onChange={(stage) => {
            const fresh = stage as Stage;
            const allowed = servicesForStage(services, fresh).map((s) => s.id);
            setV({ ...v, stage: fresh, services: v.services.filter((id) => allowed.includes(id)) });
          }}
          options={(Object.keys(STAGES) as Stage[]).map((e) => ({
            value: e,
            ...STAGES[e],
            disabled: editing && e !== v.stage,
          }))}
        />
        {errors.fields.stage ? <p className="text-sm text-destructive">{errors.fields.stage}</p> : null}
      </Section>
      <Section
        title="Serviços que esta estação chama"
        description={v.stage === "triage" ? "Só aparecem os serviços que passam pela triagem." : undefined}
      >
        <Bookings
          values={v.services}
          onChange={(checked) => setV({ ...v, services: checked })}
          options={offered.map((s) => ({ value: s.id, label: s.name, description: `Senha ${s.prefix}` }))}
          empty={
            v.stage === "triage"
              ? "Nenhum serviço desta unidade passa pela triagem."
              : "Nenhum serviço nesta unidade. Cadastre um em Serviços."
          }
        />
        {errors.fields.services ? <p className="text-sm text-destructive">{errors.fields.services}</p> : null}
      </Section>
      <Notice text={errors.general} />
    </SidePanel>
  );
}

/** Erro de validação no cliente, levado do `enviar` até o painel para marcar os campos. */
class LocalErrors extends Error {
  constructor(readonly errors: SendingErrors) {
    super("validação");
  }
}

export default function Stations() {
  const api = useApi();
  const confirm = useConfirm();
  const { current } = useCurrentUnit(["configure_services_sessions_stations_tv"]);
  const stations = useList<Station>(current ? `/v1/panel/units/${current}/stations` : null);
  const { items: services } = useList<Service>(current ? `/v1/panel/units/${current}/services` : null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "?";

  async function archive(est: Station) {
    if (!(await confirm({ title: `Arquivar a estação ${est.name}?`, action: "Arquivar", danger: true }))) return;
    try {
      await api.del(`/v1/panel/stations/${est.id}`);
      setNotice(null);
      setOk(`Estação ${est.name} arquivada.`);
      stations.reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Estações"
        description="Salas e consultórios que chamam pacientes, e os serviços que cada uma atende."
        actions={
          current ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Adicionar estação
            </Button>
          ) : null
        }
      />
      <Notice text={stations.error ?? notice} />
      <Notice text={ok} kind="ok" />
      {current ? (
        <DataTable header={["Nome", "Etapa", "Serviços", ""]}>
          {stations.items.map((est) => (
            <TableRow key={est.id}>
              <TableCell className="font-semibold text-slate-900">{est.name}</TableCell>
              <TableCell>{STAGES[est.stage].label}</TableCell>
              <TableCell className="whitespace-normal">{est.services.map(serviceName).join(", ") || "—"}</TableCell>
              <TableCell>
                <RowActions
                  exclude={{ label: `Arquivar ${est.name}`, onClick: () => archive(est) }}
                  edit={{ label: `Editar ${est.name}`, onClick: () => setEditing(est) }}
                />
              </TableCell>
            </TableRow>
          ))}
          {stations.items.length === 0 && !stations.error ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                Nenhuma estação nesta unidade. Use "Adicionar estação".
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
      <StationPanel
        open={creating}
        onClose={() => setCreating(false)}
        title="Adicionar estação"
        action="Criar estação"
        initial={EMPTY}
        editing={false}
        services={services}
        send={async (v) => {
          const invalid = validateClient(stationInputSchema, v);
          if (invalid) throw new LocalErrors(invalid);
          await api.post(`/v1/panel/units/${current}/stations`, v);
          setOk(`Estação ${v.name.trim()} criada.`);
          stations.reload();
        }}
      />
      <StationPanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Editar ${editing?.name ?? "estação"}`}
        action="Salvar"
        initial={editing ? { name: editing.name, stage: editing.stage, services: editing.services } : EMPTY}
        editing
        services={services}
        send={async (v) => {
          if (!editing) return;
          // Só vai o que mudou (o schema da edição é estrito e parcial).
          const body: { name?: string; services?: string[] } = {};
          if (v.name !== editing.name) body.name = v.name;
          const same =
            v.services.length === editing.services.length && v.services.every((id) => editing.services.includes(id));
          if (!same) body.services = v.services;
          if (Object.keys(body).length === 0) return;
          const invalid = validateClient(stationEditSchema, body);
          if (invalid) throw new LocalErrors(invalid);
          await api.patch(`/v1/panel/stations/${editing.id}`, body);
          setOk(`Estação ${v.name.trim()} salva.`);
          stations.reload();
        }}
      />
    </div>
  );
}
