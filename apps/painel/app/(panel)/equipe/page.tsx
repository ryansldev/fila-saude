"use client";

import { assignmentsSchema, staffUserInputSchema } from "@fila-saude/schemas/user";
import { PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useConfirm } from "@/components/dialogs";
import {
  ButtonAddRow,
  DataTable,
  FormField,
  Notice,
  Password,
  Section,
  Selection,
  SidePanel,
  Text,
} from "@/components/form";
import { PageHeader, RowActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { errorMessage, type SendingErrors, sendingErrors, validateClient } from "@/lib/forms/errors";
import {
  ALL_OCCUPATIONS,
  type Assignments,
  assignableUnits,
  assignmentsSummary,
  grantableRoles,
  OCCUPATIONS,
  type Occupation,
  ROLES,
  type Role,
  registrationProblems,
} from "@/lib/forms/user";
import { useMe } from "@/lib/session";
import { useList } from "@/lib/use-list";

type User = Assignments & { id: string; login: string; name: string };
type Unit = { id: string; name: string };

const WITHOUT_ERRORS: SendingErrors = { general: null, fields: {} };
const EMPTY: Assignments = { unitLinks: [], roles: [] };
const OCCUPATION_OPTIONS = ALL_OCCUPATIONS.map((o) => ({ value: o, label: OCCUPATIONS[o].label }));
// Só o que o login aceita (sem acento, espaço ou hífen): a pessoa vê na hora.
const loginMask = (t: string) => t.toLowerCase().replace(/[^a-z0-9_.]/g, "");

/** Botão neutro de tirar uma linha da lista (só o ícone; o nome vai no aria-label). */
function ButtonRemove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="text"
      size="icon"
      className="mb-0.5"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <XIcon />
    </Button>
  );
}

/** Subtítulo de um grupo dentro da seção, com a linha de explicação. */
function Group({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** Ocupações por unidade e funções, com só o que o ator pode conceder. */
function AssignmentsEditor({
  value,
  change,
  actor,
  units,
  errors,
}: {
  value: Assignments;
  change: (a: Assignments) => void;
  actor: Assignments;
  units: Unit[];
  errors: Record<string, string>;
}) {
  const allowed = assignableUnits(actor, units);
  const roles = grantableRoles(actor);
  const first = allowed.length === 1 ? (allowed[0]?.id ?? "") : "";
  const unitOptions = allowed.map((u) => ({ value: u.id, label: u.name }));
  const roleOptions = roles.map((fn) => ({ value: fn, label: ROLES[fn].label }));
  const row = "grid items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]";

  const unitSelector = (current: string | null, onChange: (id: string) => void, error?: string) => (
    <FormField label="Unidade" error={error}>
      <Selection value={current ?? ""} options={unitOptions} placeholder="Escolha a unidade" onChange={onChange} />
    </FormField>
  );

  return (
    <div className="flex flex-col gap-6">
      <Group title="Ocupação na unidade" description="O que a pessoa é na unidade (o mesmo do vínculo no CNES).">
        {value.unitLinks.map((v, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
          <div key={i} className={row}>
            {unitSelector(
              v.unitId,
              (id) =>
                change({ ...value, unitLinks: value.unitLinks.map((x, j) => (j === i ? { ...x, unitId: id } : x)) }),
              errors[`vinculos.${i}.unidadeId`],
            )}
            <FormField label="Ocupação">
              <Selection
                value={v.occupation}
                options={OCCUPATION_OPTIONS}
                onChange={(occupation) =>
                  change({
                    ...value,
                    unitLinks: value.unitLinks.map((x, j) =>
                      j === i ? { ...x, occupation: occupation as Occupation } : x,
                    ),
                  })
                }
              />
            </FormField>
            <ButtonRemove
              label={`Remover ocupação ${i + 1}`}
              onClick={() => change({ ...value, unitLinks: value.unitLinks.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        <ButtonAddRow
          label={value.unitLinks.length === 0 ? "Adicionar ocupação" : "Adicionar outra ocupação"}
          disabled={allowed.length === 0}
          onClick={() =>
            change({ ...value, unitLinks: [...value.unitLinks, { unitId: first, occupation: "reception" }] })
          }
        />
      </Group>

      {roles.length > 0 ? (
        <Group
          title="Funções e permissões"
          description="Gestão e permissões extras. Só aparece o que você pode conceder."
        >
          {value.roles.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
            <div key={i} className={row}>
              <FormField label="Função">
                <Selection
                  value={f.role}
                  options={roleOptions}
                  onChange={(chosen) => {
                    if (!chosen) return;
                    const role = chosen as Role;
                    const fromMunicipality = ROLES[role].scope === "municipality";
                    change({
                      ...value,
                      roles: value.roles.map((x, j) =>
                        j === i ? { role, unitId: fromMunicipality ? null : (x.unitId ?? (first || null)) } : x,
                      ),
                    });
                  }}
                />
              </FormField>
              {ROLES[f.role].scope === "unit" ? (
                unitSelector(
                  f.unitId,
                  (id) =>
                    change({
                      ...value,
                      roles: value.roles.map((x, j) => (j === i ? { ...x, unitId: id || null } : x)),
                    }),
                  errors[`funcoes.${i}.unidadeId`],
                )
              ) : (
                <span className="pb-2 text-sm text-slate-500">Vale para todo o município</span>
              )}
              <ButtonRemove
                label={`Remover função ${i + 1}`}
                onClick={() => change({ ...value, roles: value.roles.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <ButtonAddRow
            label={value.roles.length === 0 ? "Adicionar função" : "Adicionar outra função"}
            onClick={() => {
              const role = roles.includes("scheduler") ? "scheduler" : (roles[0] as Role);
              const unitId = ROLES[role].scope === "municipality" ? null : first || null;
              change({ ...value, roles: [...value.roles, { role, unitId }] });
            }}
          />
        </Group>
      ) : null}
      {errors._ ? <span className="text-sm text-destructive">{errors._}</span> : null}
    </div>
  );
}

const clear = (a: Assignments): Assignments => ({
  unitLinks: a.unitLinks.map((v) => ({ ...v, unitId: v.unitId })),
  roles: a.roles.map((f) => ({ ...f, unitId: f.unitId || null })),
});

export default function Staff() {
  const api = useApi();
  const me = useMe();
  const users = useList<User>("/v1/panel/users");
  const { items: units } = useList<Unit>("/v1/panel/units");
  const [v, setV] = useState({ login: "", name: "", password: "" });
  const [assignments, setAssignments] = useState<Assignments>(EMPTY);
  const [errors, setErrors] = useState(WITHOUT_ERRORS);
  const [ok, setOk] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: Assignments; errors: SendingErrors } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const confirm = useConfirm();

  if (me.state !== "authenticated") return null;
  const actor: Assignments = { unitLinks: me.me.unitLinks, roles: me.me.roles };
  const unitName = (id: string | null) => (id ? (units.find((u) => u.id === id)?.name ?? "?") : "");

  async function create() {
    setOk(null);
    const target = clear(assignments);
    const problems = registrationProblems(actor, target);
    if (Object.keys(problems).length > 0) return setErrors({ general: null, fields: problems });
    const body = { ...v, ...target };
    const invalid = validateClient(staffUserInputSchema, body);
    if (invalid) return setErrors(invalid);
    setSending(true);
    try {
      await api.post("/v1/panel/users", body);
      setErrors(WITHOUT_ERRORS);
      setCreating(false);
      setOk(`${v.name} cadastrado(a). Passe o login e a senha para a pessoa.`);
      setV({ login: "", name: "", password: "" });
      setAssignments(EMPTY);
      users.reload();
    } catch (err) {
      setErrors(sendingErrors(err));
    } finally {
      setSending(false);
    }
  }

  async function remove(u: User) {
    const ok = await confirm({
      title: `Excluir ${u.name} da equipe?`,
      description: "A pessoa não consegue mais entrar no painel.",
      action: "Excluir",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/v1/panel/users/${u.id}`);
      setNotice(null);
      if (editing?.id === u.id) setEditing(null);
      users.reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  async function save() {
    if (!editing) return;
    const target = clear(editing.value);
    const problems = registrationProblems(actor, target);
    if (Object.keys(problems).length > 0)
      return setEditing({ ...editing, errors: { general: null, fields: problems } });
    const invalid = validateClient(assignmentsSchema, target);
    if (invalid) return setEditing({ ...editing, errors: invalid });
    setSending(true);
    try {
      await api.put(`/v1/panel/users/${editing.id}/assignments`, target);
      setOk(`${nameOf(editing.id)}: ocupações e funções salvas.`);
      setEditing(null);
      users.reload();
    } catch (err) {
      const e = sendingErrors(err);
      setEditing({ ...editing, errors: e.general ? e : { general: errorMessage(err), fields: e.fields } });
    } finally {
      setSending(false);
    }
  }

  const nameOf = (id: string) => users.items.find((u) => u.id === id)?.name ?? "";

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="Equipe"
        description="Quem entra no painel e o que cada pessoa faz em cada unidade."
        actions={
          <Button
            onClick={() => {
              setErrors(WITHOUT_ERRORS);
              setCreating(true);
            }}
          >
            <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
            Adicionar usuário
          </Button>
        }
      />
      <Notice text={users.error ?? notice} />
      <Notice text={ok} kind="ok" />
      <DataTable header={["Nome", "Login", "Ocupações e funções", ""]}>
        {users.items.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-semibold text-slate-900">{u.name}</TableCell>
            <TableCell>{u.login}</TableCell>
            <TableCell className="whitespace-normal">{assignmentsSummary(u, unitName)}</TableCell>
            <TableCell>
              <RowActions
                {...(u.id !== me.me.id ? { exclude: { label: `Excluir ${u.name}`, onClick: () => remove(u) } } : {})}
                edit={{
                  label: `Editar ${u.name}`,
                  onClick: () =>
                    setEditing({ id: u.id, value: { unitLinks: u.unitLinks, roles: u.roles }, errors: WITHOUT_ERRORS }),
                }}
              />
            </TableCell>
          </TableRow>
        ))}
        {users.items.length === 0 && !users.error ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-slate-500">
              Ninguém na equipe ainda. Use "Adicionar usuário".
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>

      <SidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Editar ${editing ? nameOf(editing.id) : "usuário"}`}
        description="Ocupações e funções desta pessoa em cada unidade."
        onSend={save}
        action="Salvar"
        sending={sending}
      >
        {editing ? (
          <>
            <Section title="O que a pessoa faz" description="Define as telas e as ações que ela vê no painel.">
              <AssignmentsEditor
                value={editing.value}
                change={(value) => setEditing({ ...editing, value })}
                actor={actor}
                units={units}
                errors={editing.errors.fields}
              />
            </Section>
            <Notice text={editing.errors.general} />
          </>
        ) : null}
      </SidePanel>

      <SidePanel
        open={creating}
        onClose={() => setCreating(false)}
        title="Adicionar usuário"
        description="Login e senha inicial para o painel, e o que a pessoa faz em cada unidade."
        onSend={create}
        action="Cadastrar"
        sending={sending}
      >
        <Section title="Acesso ao painel" description="Passe o login e a senha para a pessoa; ela entra com eles.">
          <FormField label="Nome" error={errors.fields.name}>
            <Text required value={v.name} onChange={(name) => setV({ ...v, name })} />
          </FormField>
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <FormField label="Login" error={errors.fields.login} hint="Letras, números, ponto ou _.">
              <Text
                required
                autoCapitalize="none"
                maxLength={30}
                value={v.login}
                mask={loginMask}
                onChange={(login) => setV({ ...v, login })}
              />
            </FormField>
            <FormField label="Senha inicial" error={errors.fields.password} hint="Mínimo de 8 caracteres.">
              <Password
                required
                autoComplete="new-password"
                value={v.password}
                onChange={(password) => setV({ ...v, password })}
              />
            </FormField>
          </div>
        </Section>
        <Section title="O que a pessoa faz" description="Define as telas e as ações que ela vê no painel.">
          <AssignmentsEditor
            value={assignments}
            change={setAssignments}
            actor={actor}
            units={units}
            errors={errors.fields}
          />
        </Section>
        <Notice text={errors.general} />
      </SidePanel>
    </div>
  );
}
