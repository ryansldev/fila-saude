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

const CampoAtual = createContext<{ id: string; invalido: boolean } | null>(null);

export function Campo({
  rotulo,
  erro,
  dica,
  className,
  children,
}: {
  rotulo: string;
  erro?: string | undefined;
  dica?: string | undefined;
  /** Largura em filtros de linha (ex.: "sm:w-72"); sem isso ocupa a linha toda. */
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <CampoAtual.Provider value={{ id, invalido: Boolean(erro) }}>
      <Field data-invalid={erro ? true : undefined} className={cn("gap-2", className)}>
        <FieldLabel htmlFor={id} className="font-semibold text-slate-700">
          {rotulo}
        </FieldLabel>
        {children}
        {dica ? <FieldDescription>{dica}</FieldDescription> : null}
        {erro ? <FieldError>{erro}</FieldError> : null}
      </Field>
    </CampoAtual.Provider>
  );
}

/** Campo de texto. `mascara` formata enquanto digita (CPF, CEP...); `aoMudar` recebe o valor final. */
export function Texto({
  valor,
  aoMudar,
  mascara,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  valor: string;
  aoMudar: (v: string) => void;
  mascara?: (v: string) => string;
}) {
  const campo = useContext(CampoAtual);
  return (
    <Input
      id={campo?.id}
      aria-invalid={campo?.invalido || undefined}
      value={valor}
      onChange={(e) => aoMudar(mascara ? mascara(e.target.value) : e.target.value)}
      {...props}
    />
  );
}

export type Opcao = { valor: string; rotulo: string };

/** Lista de escolha (Select do shadcn). Valor vazio = nada escolhido, mostra o `placeholder`. */
export function Selecao({
  valor,
  aoMudar,
  opcoes,
  placeholder = "Escolha",
  disabled,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: Opcao[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const campo = useContext(CampoAtual);
  return (
    <Select
      value={valor || null}
      onValueChange={(v) => aoMudar(typeof v === "string" ? v : "")}
      items={opcoes.map((o) => ({ value: o.valor, label: o.rotulo }))}
      disabled={disabled ?? false}
    >
      <SelectTrigger id={campo?.id} aria-invalid={campo?.invalido || undefined} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Caixa de marcar com o rótulo ao lado (clicar no texto também marca). */
export function Caixa({
  rotulo,
  marcada,
  aoMudar,
  disabled,
}: {
  rotulo: ReactNode;
  marcada: boolean;
  aoMudar: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" className="items-center gap-2">
      <Checkbox id={id} checked={marcada} onCheckedChange={(v) => aoMudar(v === true)} disabled={disabled ?? false} />
      <FieldLabel htmlFor={id} className="font-normal">
        {rotulo}
      </FieldLabel>
    </Field>
  );
}

export function Aviso({ texto, tipo = "erro" }: { texto: string | null; tipo?: "erro" | "ok" }) {
  if (!texto) return null;
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={
        tipo === "erro"
          ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
      }
    >
      {texto}
    </p>
  );
}

export function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
      {children}
    </section>
  );
}

/** Tabela do shadcn; as linhas usam `TableRow`/`TableCell` (ou <tr>/<td> com as mesmas classes). */
export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="hover:bg-transparent">
            {cabecalho.map((c, i) => (
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
export const LARGURA_DO_PAINEL_LATERAL =
  "gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl";

// ---------------------------------------------------------------------------------------------
// Formulários em painel lateral (revisão de UX, 2026-11-13): seções com título e explicação,
// escolhas em cartões com descrição, interruptor para sim/não, número com unidade, e o rodapé
// sempre visível com "Cancelar" e a ação principal à direita.

/** Bloco do formulário: título curto, uma linha de explicação e os campos. */
export function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 border-b border-slate-100 pb-8 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-0.5">
        <legend className="text-base font-bold text-slate-900">{titulo}</legend>
        {descricao ? <p className="text-sm text-slate-500">{descricao}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

export type OpcaoComDescricao = { valor: string; rotulo: string; descricao?: string; desativada?: boolean };

/** Uma escolha entre poucas opções, em cartões com descrição (no lugar de uma lista fechada). */
export function Escolha({
  valor,
  aoMudar,
  opcoes,
  colunas = 2,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: OpcaoComDescricao[];
  colunas?: 1 | 2 | 3;
}) {
  const campo = useContext(CampoAtual);
  const grade = colunas === 1 ? "" : colunas === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <RadioGroup
      id={campo?.id}
      value={valor}
      onValueChange={(v) => aoMudar(String(v))}
      className={cn("grid gap-2", grade)}
      aria-invalid={campo?.invalido || undefined}
    >
      {opcoes.map((o) => (
        <label
          key={o.valor}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300",
            "has-data-checked:border-primary has-data-checked:bg-primary-50/60",
            o.desativada && "cursor-not-allowed opacity-50",
          )}
        >
          <RadioGroupItem value={o.valor} disabled={o.desativada ?? false} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-900">{o.rotulo}</span>
            {o.descricao ? <span className="text-sm text-slate-500">{o.descricao}</span> : null}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

/** Sim/não com explicação ao lado (no lugar de uma caixinha solta). */
export function Interruptor({
  rotulo,
  descricao,
  marcado,
  aoMudar,
  disabled,
}: {
  rotulo: string;
  descricao?: string;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5">
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
        <span className="font-semibold text-slate-900">{rotulo}</span>
        {descricao ? <span className="text-sm text-slate-500">{descricao}</span> : null}
      </label>
      <Switch id={id} checked={marcado} onCheckedChange={(v) => aoMudar(v === true)} disabled={disabled ?? false} />
    </div>
  );
}

/** Número inteiro com a unidade ao lado ("min", "vagas"); só aceita dígitos. */
export function Numero({
  valor,
  aoMudar,
  sufixo,
  placeholder,
  maxDigitos = 4,
  disabled,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  sufixo?: string;
  placeholder?: string;
  maxDigitos?: number;
  disabled?: boolean;
}) {
  const campo = useContext(CampoAtual);
  return (
    <div className="relative w-full sm:w-44">
      <Input
        id={campo?.id}
        aria-invalid={campo?.invalido || undefined}
        inputMode="numeric"
        value={valor}
        placeholder={placeholder}
        disabled={disabled ?? false}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, "").slice(0, maxDigitos))}
        className={sufixo ? "pr-14" : undefined}
      />
      {sufixo ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
          {sufixo}
        </span>
      ) : null}
    </div>
  );
}

/** Várias opções marcáveis em cartões (ex.: as estações de uma sessão). */
export function Marcacoes({
  valores,
  aoMudar,
  opcoes,
  vazio = "Nenhuma opção disponível.",
}: {
  valores: string[];
  aoMudar: (v: string[]) => void;
  opcoes: OpcaoComDescricao[];
  vazio?: string;
}) {
  if (opcoes.length === 0) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opcoes.map((o) => {
        const marcada = valores.includes(o.valor);
        return (
          <label
            key={o.valor}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300",
              marcada && "border-primary bg-primary-50/60",
            )}
          >
            <Checkbox
              checked={marcada}
              onCheckedChange={(v) =>
                aoMudar(v === true ? [...valores, o.valor] : valores.filter((x) => x !== o.valor))
              }
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-slate-900">{o.rotulo}</span>
              {o.descricao ? <span className="text-sm text-slate-500">{o.descricao}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Painel lateral de cadastro ou edição. Com `aoEnviar`, o corpo é um formulário e o rodapé fixo
 * traz "Cancelar" e a ação principal (`acao`) à direita; `perigo` é um botão vermelho discreto
 * à esquerda (ex.: "Cancelar sessão").
 */
export function PainelLateral({
  aberto,
  aoFechar,
  titulo,
  descricao,
  aoEnviar,
  acao = "Salvar",
  enviando = false,
  perigo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  aoEnviar?: () => void;
  acao?: string;
  enviando?: boolean;
  perigo?: { rotulo: string; aoClicar: () => void };
  children: ReactNode;
}) {
  return (
    <Sheet open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <SheetContent side="right" className={LARGURA_DO_PAINEL_LATERAL}>
        <SheetHeader className="border-b border-slate-100 px-6 py-5">
          <SheetTitle className="text-xl font-extrabold tracking-tight text-slate-900">{titulo}</SheetTitle>
          {descricao ? <SheetDescription>{descricao}</SheetDescription> : null}
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            aoEnviar?.();
          }}
        >
          <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-7">{children}</div>
          {aoEnviar || perigo ? (
            <SheetFooter className="flex-row items-center border-t border-slate-100 px-6 py-4">
              {perigo ? (
                <Button type="button" variant="ghost" className="text-destructive" onClick={perigo.aoClicar}>
                  {perigo.rotulo}
                </Button>
              ) : null}
              <div className="flex-1" />
              <Button type="button" variant="ghost" onClick={aoFechar}>
                Cancelar
              </Button>
              {aoEnviar ? (
                <Button type="submit" disabled={enviando}>
                  {acao}
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
export function BotaoAdicionarLinha({
  rotulo,
  aoClicar,
  disabled,
}: {
  rotulo: string;
  aoClicar: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={disabled}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-600 transition-colors",
        "hover:border-primary/60 hover:bg-primary-50/50 hover:text-primary-600",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-600",
      )}
    >
      <PlusIcon className="size-4" strokeWidth={2.5} />
      {rotulo}
    </button>
  );
}

/** Senha com o botão de mostrar/esconder dentro do campo (olho). */
export function Senha({
  valor,
  aoMudar,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Texto type={ver ? "text" : "password"} valor={valor} aoMudar={aoMudar} className="pr-12" {...props} />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Esconder senha" : "Mostrar senha"}
        title={ver ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {ver ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  );
}
