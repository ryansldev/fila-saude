import { TONE_CLASSES, type Tone } from "@/lib/scheduling";

const TONES_EXTRAS = { danger: "bg-red-100 text-red-900" } as const;

/** Selo pequeno e arredondado: situação, risco, "sem app", alertas. */
export function Badge({ text, tone }: { text: string; tone: Tone | keyof typeof TONES_EXTRAS }) {
  const cssClass = tone in TONES_EXTRAS ? TONES_EXTRAS[tone as "danger"] : TONE_CLASSES[tone as Tone];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${cssClass}`}>{text}</span>;
}
