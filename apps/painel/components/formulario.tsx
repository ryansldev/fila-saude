"use client";

import { createContext, type ReactNode, useContext, useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <Field data-invalid={erro ? true : undefined} className={cn("gap-1.5", className)}>
        <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
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
