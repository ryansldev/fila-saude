"use client";

import { useEffect, useMemo, useState } from "react";
import { qrEstilizado } from "@/lib/qr";
import { cn } from "@/lib/utils";

/**
 * O QR de entrada do design system: pontos pretos, coração azul, moldura branca com sombra leve e a
 * barrinha que mostra quando o código vai trocar.
 */
export function QrDeEntrada({
  conteudo,
  expiraEm,
  intervaloSegundos,
  className,
}: {
  conteudo: string;
  expiraEm: string | null;
  intervaloSegundos: number;
  className?: string;
}) {
  const svg = useMemo(() => qrEstilizado(conteudo), [conteudo]);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const restante = expiraEm ? Math.max(0, Math.min(1, (Date.parse(expiraEm) - agora) / (intervaloSegundos * 1000))) : 1;
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className="w-full rounded-[1.1em] bg-white p-[6%] shadow-[0_1px_0_#e1e8ea,0_6px_18px_rgba(12,46,78,0.07)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG gerado localmente (qrEstilizado).
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="mt-[6%] h-1 w-[70%] overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className="h-full rounded-full bg-[#9cc4ea] transition-[width] duration-500"
          style={{ width: `${restante * 100}%` }}
        />
      </div>
    </div>
  );
}
