import { CLASSES_DO_TOM, type Tom } from "@/lib/agendamento";

const TONS_EXTRAS = { perigo: "bg-red-100 text-red-900" } as const;

/** Selo pequeno e arredondado: situação, risco, "sem app", alertas. */
export function Selo({ texto, tom }: { texto: string; tom: Tom | keyof typeof TONS_EXTRAS }) {
  const classe = tom in TONS_EXTRAS ? TONS_EXTRAS[tom as "perigo"] : CLASSES_DO_TOM[tom as Tom];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${classe}`}>{texto}</span>;
}
