"use client";

import { useEffect, useMemo, useState } from "react";
import { qrRemaining, styledQr } from "@/lib/qr";
import { cn } from "@/lib/utils";

/**
 * O QR de entrada do design system: pontos pretos, coração azul, moldura branca com sombra leve e a
 * barrinha que mostra quando o código vai trocar.
 */
export function EntryQr({
  content,
  expiresAt,
  serverNow,
  intervalSeconds,
  className,
}: {
  content: string;
  expiresAt: string | null;
  /** A hora do servidor na resposta do QR. */
  serverNow: string;
  intervalSeconds: number;
  className?: string;
}) {
  const svg = useMemo(() => styledQr(content), [content]);
  const [now, setNow] = useState(() => Date.now());
  // Quando chegou a resposta, no relógio do computador: a barrinha conta o que passou desde então.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `serverNow` muda a cada resposta (é o gatilho).
  const receivedAt = useMemo(() => Date.now(), [serverNow]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const remaining = qrRemaining(expiresAt, Date.parse(serverNow), receivedAt, now, intervalSeconds);
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
          style={{ width: `${remaining * 100}%` }}
        />
      </div>
    </div>
  );
}
