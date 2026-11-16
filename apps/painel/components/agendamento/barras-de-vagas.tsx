import { barrasDeVagas, textoDasVagas } from "@/lib/agendamento";
import { cn } from "@/lib/utils";

const COR_DA_BARRA = { confirmada: "bg-green-600", pendente: "bg-amber-400", livre: "bg-slate-200" } as const;

/** As vagas da sessão em barrinhas (verde confirmou, amarelo aguarda resposta, cinza livre). */
export function BarrasDeVagas({
  vagas,
  ocupadas,
  confirmadas,
  pendentes,
  className,
}: {
  vagas: number | null;
  ocupadas: number;
  confirmadas: number;
  pendentes: number;
  className?: string;
}) {
  const barras = barrasDeVagas({ vagas, confirmadas, pendentes });
  if (!barras) return <span className="text-xs text-slate-500">{textoDasVagas(ocupadas, null)}</span>;
  return (
    <span className={cn("flex flex-wrap gap-1", className)} role="img" aria-label={textoDasVagas(ocupadas, vagas)}>
      {barras.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as barras não têm id; a posição é a vaga.
        <span key={i} className={cn("block h-2 w-5 rounded-full", COR_DA_BARRA[b])} />
      ))}
    </span>
  );
}
