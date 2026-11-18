import { COLOR } from "@fila-saude/design";
import Link from "next/link";
import type { ReactNode } from "react";
import { Character } from "@/components/character";
import { SurfaceCard } from "@/components/landing/surface-card";
import { SpeechBubble } from "@/components/speech-bubble";

// Cartão com relevo: o mesmo `SurfaceCard` da landing (borda clara, 4 px embaixo, cantos de 16 px).
// Com `href`, o cartão inteiro é o link.
export function Card({
  title,
  href,
  icon,
  children,
}: {
  title: string;
  href?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const body = (
    <>
      {icon ? (
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--color-fd-secondary)] text-[var(--color-fd-primary)] [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className="text-lg font-extrabold tracking-tight text-[var(--color-fd-foreground)]">{title}</span>
      {children ? (
        <span className="text-[0.95rem] leading-relaxed text-[var(--color-fd-muted-foreground)]">{children}</span>
      ) : null}
    </>
  );
  const box = "not-prose flex h-full flex-col gap-2 p-5";
  if (!href) return <SurfaceCard className={box}>{body}</SurfaceCard>;
  return (
    <Link href={href} className="not-prose block no-underline transition-transform hover:-translate-y-0.5">
      <SurfaceCard className={box}>{body}</SurfaceCard>
    </Link>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid gap-4 sm:grid-cols-2">{children}</div>;
}

const CALLOUT = {
  info: { background: COLOR.primary50, color: COLOR.primary900 },
  warn: { background: COLOR.warningBg, color: COLOR.warningInk },
  error: { background: COLOR.dangerBg, color: COLOR.dangerInk },
  success: { background: COLOR.successBg, color: COLOR.successInk },
} as const;

// Aviso nas cores de estado do DS (`packages/design`): informação, atenção, erro e sucesso.
export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: keyof typeof CALLOUT | "warning";
  title?: string;
  children: ReactNode;
}) {
  const tone = CALLOUT[type === "warning" ? "warn" : type];
  return (
    <div
      className="my-6 rounded-2xl border-2 px-5 py-4 text-[0.95rem] leading-relaxed"
      style={{ ...tone, borderColor: COLOR.line }}
    >
      {title ? <span className="mb-1 block font-extrabold">{title}</span> : null}
      <div className="prose-no-margin [&_a]:text-inherit [&_a]:underline [&_code]:bg-white/60">{children}</div>
    </div>
  );
}

// O Dr. Lino, sempre sobre fundo branco (o jaleco é transparente), com um balão de fala.
export function Lino({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-8 flex flex-col items-center gap-4 bg-white sm:flex-row sm:items-center sm:gap-6">
      <Character size="xs" className="w-[96px] sm:w-[110px]" />
      <SpeechBubble className="text-[1.05rem] leading-relaxed text-[var(--color-fd-foreground)]">
        {children}
      </SpeechBubble>
    </div>
  );
}
