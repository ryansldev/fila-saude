"use client";

import { EyeIcon, EyeOffIcon, PlusIcon } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Kit de formulário do painel sobre o shadcn (base-nova). As telas usam só estes componentes:
// nada de <input>/<select> nativos. `Campo` liga o rótulo ao controle e marca o erro.

const CurrentField = createContext<{ id: string; invalid: boolean } | null>(null);

export function FormField({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** Largura em filtros de linha (ex.: "sm:w-72"); sem isso ocupa a linha toda. */
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <CurrentField.Provider value={{ id, invalid: Boolean(error) }}>
      <Field data-invalid={error ? true : undefined} className={cn("gap-2", className)}>
        <FieldLabel htmlFor={id} className="font-semibold text-slate-700">
          {label}
        </FieldLabel>
        {children}
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    </CurrentField.Provider>
  );
}

/** Campo de texto. `mask` formata enquanto digita (CPF, CEP...); `onChange` recebe o valor final. */
export function Text({
  value,
  onChange,
  mask,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
  mask?: (v: string) => string;
}) {
  const field = useContext(CurrentField);
  return (
    <Input
      id={field?.id}
      aria-invalid={field?.invalid || undefined}
      value={value}
      onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)}
      {...props}
    />
  );
}

export type Option = { value: string; label: string };

/** Lista de escolha (Select do shadcn). Valor vazio = nada escolhido, mostra o `placeholder`. */
export function Selection({
  value,
  onChange,
  options,
  placeholder = "Escolha",
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const field = useContext(CurrentField);
  return (
    <Select
      value={value || null}
      onValueChange={(v) => onChange(typeof v === "string" ? v : "")}
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      disabled={disabled ?? false}
    >
      <SelectTrigger id={field?.id} aria-invalid={field?.invalid || undefined} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Caixa de marcar com o rótulo ao lado (clicar no texto também marca). */
export function Box({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" className="items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled ?? false} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}

export function Notice({ text, kind = "error" }: { text: string | null; kind?: "error" | "ok" }) {
  if (!text) return null;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
      }
    >
      {text}
    </p>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

/** Tabela do shadcn; as linhas usam `TableRow`/`TableCell` (ou <tr>/<td> com as mesmas classes). */
export function DataTable({ header, children }: { header: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="hover:bg-transparent">
            {header.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cabeçalhos podem ser vazios e repetidos.
              <TableHead key={i} className="h-11 px-4 font-bold text-slate-500 first:pl-6 last:pr-6">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_td]:px-4 [&_td]:py-3.5 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6">
          {children}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Padrão dos painéis laterais (Sheet) de cadastro e edição: botões de ação alinhados à direita,
 * o principal (primary) na ponta e "Cancelar" (ghost) antes dele.
 * Largura dos painéis laterais (Sheet) de cadastro e edição. Precisa do mesmo prefixo
 * `data-[side=right]` da classe padrão do shadcn para vencer o `sm:max-w-sm`.
 */
export const SIDE_PANEL_WIDTH =
  "gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl";

// ---------------------------------------------------------------------------------------------
// Formulários em painel lateral (revisão de UX, 2026-11-13): seções com título e explicação,
// escolhas em cartões com descrição, interruptor para sim/não, número com unidade, e o rodapé
// sempre visível com "Cancelar" e a ação principal à direita.

/** Bloco do formulário: título curto, uma linha de explicação e os campos. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-5 border-b border-slate-100 pb-8 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-0.5">
        <legend className="text-base font-bold text-slate-900">{title}</legend>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

export type OptionWithDescription = { value: string; label: string; description?: string; disabled?: boolean };

/** Uma escolha entre poucas opções, em cartões com descrição (no lugar de uma lista fechada). */
export function Choice({
  value,
  onChange,
  options,
  columns = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  options: OptionWithDescription[];
  columns?: 1 | 2 | 3;
}) {
  const field = useContext(CurrentField);
  const grid = columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <RadioGroup
      id={field?.id}
      value={value}
      onValueChange={(v) => onChange(String(v))}
      className={cn("grid gap-2", grid)}
      aria-invalid={field?.invalid || undefined}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300",
            "has-data-checked:border-primary has-data-checked:bg-primary-50/60",
            o.disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <RadioGroupItem value={o.value} disabled={o.disabled ?? false} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-900">{o.label}</span>
            {o.description ? <span className="text-sm text-slate-500">{o.description}</span> : null}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

/** Sim/não com explicação ao lado (no lugar de uma caixinha solta). */
export function SwitchField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5">
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
        <span className="font-semibold text-slate-900">{label}</span>
        {description ? <span className="text-sm text-slate-500">{description}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled ?? false} />
    </div>
  );
}

/** Número inteiro com a unidade ao lado ("min", "vagas"); só aceita dígitos. */
export function NumberField({
  value,
  onChange,
  suffix,
  placeholder,
  maxDigits = 4,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
  maxDigits?: number;
  disabled?: boolean;
}) {
  const field = useContext(CurrentField);
  return (
    <div className="relative w-full sm:w-44">
      <Input
        id={field?.id}
        aria-invalid={field?.invalid || undefined}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        disabled={disabled ?? false}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
        className={suffix ? "pr-14" : undefined}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/** Várias opções marcáveis em cartões (ex.: as estações de uma sessão). */
export function Bookings({
  values,
  onChange,
  options,
  empty = "Nenhuma opção disponível.",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: OptionWithDescription[];
  empty?: string;
}) {
  if (options.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const checked = values.includes(o.value);
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300",
              checked && "border-primary bg-primary-50/60",
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => onChange(v === true ? [...values, o.value] : values.filter((x) => x !== o.value))}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-slate-900">{o.label}</span>
              {o.description ? <span className="text-sm text-slate-500">{o.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Painel lateral de cadastro ou edição. Com `onSubmit`, o corpo é um formulário e o rodapé fixo
 * traz "Cancelar" e a ação principal (`acao`) à direita; `perigo` é um botão vermelho discreto
 * à esquerda (ex.: "Cancelar sessão").
 */
export function SidePanel({
  open,
  onClose,
  title,
  description,
  onSend,
  action = "Salvar",
  sending = false,
  danger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onSend?: () => void;
  action?: string;
  sending?: boolean;
  danger?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className={SIDE_PANEL_WIDTH}>
        <SheetHeader className="border-b border-slate-100 px-6 py-5">
          <SheetTitle className="text-xl font-extrabold tracking-tight text-slate-900">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSend?.();
          }}
        >
          <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-7">{children}</div>
          {onSend || danger ? (
            <SheetFooter className="flex-row items-center border-t border-slate-100 px-6 py-4">
              {danger ? (
                <Button type="button" variant="dangerText" onClick={danger.onClick}>
                  {danger.label}
                </Button>
              ) : null}
              <div className="flex-1" />
              <Button type="button" variant="text" onClick={onClose}>
                Cancelar
              </Button>
              {onSend ? (
                <Button type="submit" disabled={sending}>
                  {action}
                </Button>
              ) : null}
            </SheetFooter>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Acrescentar uma linha a uma lista do formulário (ocupação, função, intervalo): bloco tracejado de
 * largura total, no lugar onde a nova linha vai aparecer.
 */
export function ButtonAddRow({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="secondary" icon={PlusIcon} onClick={onClick} disabled={disabled} className="w-full">
      {label}
    </Button>
  );
}

/** Senha com o botão de mostrar/esconder dentro do campo (olho). */
export function Password({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  const [see, setSee] = useState(false);
  return (
    <div className="relative">
      <Text type={see ? "text" : "password"} value={value} onChange={onChange} className="pr-12" {...props} />
      <Button
        variant="text"
        size="icon"
        icon={see ? EyeOffIcon : EyeIcon}
        onClick={() => setSee(!see)}
        aria-label={see ? "Esconder senha" : "Mostrar senha"}
        title={see ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-1 right-1"
      />
    </div>
  );
}
