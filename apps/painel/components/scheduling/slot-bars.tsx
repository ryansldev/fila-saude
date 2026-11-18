import { slotBars, slotText } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const BAR_COLOR = { confirmed: "bg-green-600", pending: "bg-amber-400", free: "bg-slate-200" } as const;

/** As vagas da sessão em barrinhas (verde confirmou, amarelo aguarda resposta, cinza livre). */
export function SlotBars({
  slots,
  taken,
  confirmed,
  pending,
  className,
}: {
  slots: number | null;
  taken: number;
  confirmed: number;
  pending: number;
  className?: string;
}) {
  const bars = slotBars({ slots, confirmed, pending });
  if (!bars) return <span className="text-xs text-slate-500">{slotText(taken, null)}</span>;
  return (
    <span className={cn("flex flex-wrap gap-1", className)} role="img" aria-label={slotText(taken, slots)}>
      {bars.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as barras não têm id; a posição é a vaga.
        <span key={i} className={cn("block h-2 w-5 rounded-full", BAR_COLOR[b])} />
      ))}
    </span>
  );
}
