"use client";

import { pairingInputSchema, type UnitTv } from "@fila-saude/schemas/tv";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import { DataTable, FormField, Notice, Section, SidePanel, Text } from "@/components/form";
import { PageHeader, RowActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { useCurrentUnit } from "@/lib/current-unit";
import { errorMessage, type SendingErrors, sendingErrors, validateClient } from "@/lib/forms/errors";
import { useQuery } from "@/lib/use-query";

const WITHOUT_ERRORS: SendingErrors = { general: null, fields: {} };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

/** Situação da TV como selo: verde quando mandou sinal há pouco. */
function Situation({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

/** RN-TV-01 / RN-TV-06: parear pelo código que a TV mostra em `/tv`, ver se está online e revogar. */
export default function Tvs() {
  const api = useApi();
  const confirm = useConfirm();
  const { current, unit } = useCurrentUnit(["configure_services_sessions_stations_tv"]);
  const tvs = useQuery<UnitTv[]>(current ? `/v1/panel/units/${current}/tvs` : null, 15_000);
  const [pairing, setPairing] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{ text: string; kind: "error" | "ok" } | null>(null);
  const [errors, setErrors] = useState<SendingErrors>(WITHOUT_ERRORS);
  const [sending, setSending] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: limpa o aviso só ao trocar de unidade.
  useEffect(() => setNotice(null), [current]);

  function openPairing() {
    setCode("");
    setErrors(WITHOUT_ERRORS);
    setPairing(true);
  }

  async function pair() {
    if (!current) return;
    const body = { code: code.trim() };
    const invalid = validateClient(pairingInputSchema, body);
    setErrors(invalid ?? WITHOUT_ERRORS);
    if (invalid) return;
    setSending(true);
    try {
      await api.post(`/v1/panel/units/${current}/tvs`, body);
      setCode("");
      setPairing(false);
      setNotice({ text: "TV pareada. Ela já mostra a fila da unidade.", kind: "ok" });
      tvs.reload();
    } catch (err) {
      const e = sendingErrors(err);
      setErrors(e.general || Object.keys(e.fields).length > 0 ? e : { general: errorMessage(err), fields: {} });
    } finally {
      setSending(false);
    }
  }

  async function revoke(id: string) {
    const ok = await confirm({
      title: "Revogar esta TV?",
      description: "Ela volta para a tela de pareamento.",
      action: "Revogar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/v1/panel/tvs/${id}`);
      tvs.reload();
    } catch (err) {
      setNotice({ text: errorMessage(err), kind: "error" });
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="TVs da sala de espera"
        description="As TVs mostram as senhas chamadas e o QR de entrada. Pareie pelo código que aparece na tela."
        actions={
          current ? (
            <Button onClick={openPairing}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Parear TV
            </Button>
          ) : null
        }
      />
      {notice ? <Notice text={notice.text} kind={notice.kind} /> : null}
      <Notice text={tvs.error} />
      {current && tvs.detail ? (
        <DataTable header={["Pareada em", "Último sinal", "Situação", ""]}>
          {tvs.detail.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{when(t.pairedAt)}</TableCell>
              <TableCell>{when(t.lastSignalAt)}</TableCell>
              <TableCell>
                <Situation online={t.online} />
              </TableCell>
              <TableCell>
                <RowActions exclude={{ label: "Revogar TV", onClick: () => revoke(t.id) }} />
              </TableCell>
            </TableRow>
          ))}
          {tvs.detail.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                Nenhuma TV pareada nesta unidade. Use "Parear TV".
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
      <SidePanel
        open={pairing}
        onClose={() => setPairing(false)}
        title="Parear TV"
        description={`A TV passa a mostrar a fila de ${unit?.name ?? "esta unidade"}.`}
        onSend={pair}
        action="Parear"
        sending={sending || code.length !== 6}
      >
        <Section
          title="Código da TV"
          description="Na TV, abra /tv neste mesmo endereço do painel e digite o código de 6 dígitos que aparece."
        >
          <FormField label="Código de 6 dígitos" error={errors.fields.code} className="items-center">
            <Text
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="000000"
              className="h-16 max-w-xs text-center font-mono text-3xl tracking-[0.4em] md:text-3xl"
              value={code}
              onChange={setCode}
              mask={(t) => t.replace(/\D/g, "").slice(0, 6)}
            />
          </FormField>
        </Section>
        <Notice text={errors.general} />
      </SidePanel>
    </div>
  );
}
