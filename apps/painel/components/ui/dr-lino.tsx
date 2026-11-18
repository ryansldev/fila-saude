import { LINO_SVG } from "@fila-saude/design";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** O Dr. Lino, mascote do Fila Saúde. O jaleco é transparente: o fundo é sempre branco. */
export function DrLino({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full", className)}
      role="img"
      aria-label="Dr. Lino"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG fixo do pacote de design.
      dangerouslySetInnerHTML={{ __html: LINO_SVG }}
    />
  );
}

/** Balão de fala suave do Dr. Lino: fundo azul bem claro, sem borda, com a pontinha à esquerda. */
export function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[1.1em] rounded-tl-[0.4em] bg-[#eef5fa] px-[1.1em] py-[0.8em] font-bold text-[#1f2d36]",
        "before:absolute before:top-[0.8em] before:-left-[0.45em] before:border-[0.5em] before:border-l-0 before:border-transparent before:border-r-[#eef5fa] before:content-['']",
        className,
      )}
    >
      {children}
    </div>
  );
}
