import { COLOR, LINO_SVG } from "@fila-saude/design";
import { ArrowRight, CircleCheck, Info, OctagonX, TriangleExclamationPoint } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Os componentes das docs com a cara do Fila Saúde (`.specs/features/design-system/docs.md`). Botões com as
// classes do kit (`.ds-btn-*`); cores dos tokens do `packages/design`.

// O Dr. Lino do pacote de design. O jaleco é transparente: o fundo é sempre branco.
function DrLino({ className }: { className?: string }) {
  return (
    <div
      className={`bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className ?? ""}`}
      role="img"
      aria-label="Dr. Lino"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG fixo do pacote de design.
      dangerouslySetInnerHTML={{ __html: LINO_SVG }}
    />
  );
}

type Action = { href: string; label: string };

// O topo da introdução: o Dr. Lino grande à direita do título, a fala dele no balão suave do kit e as ações.
export function Hero({
  section,
  title,
  lead,
  speech,
  detail,
  primary,
  secondary,
}: {
  section?: string;
  title: string;
  lead: string;
  speech: string;
  detail?: string;
  primary: Action;
  secondary?: Action;
}) {
  return (
    <div className="not-prose docs-hero">
      <div className="min-w-0">
        {section ? <span className="docs-eyebrow">{section}</span> : null}
        <h1 className="docs-hero-title">{title}</h1>
        <p className="docs-lead">{lead}</p>
        <div className="docs-hero-talk">
          <div className="docs-bubble">
            <strong>{speech}</strong>
            {detail ? <span>{detail}</span> : null}
          </div>
          <DrLino className="docs-hero-lino-sm" />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href={primary.href} className="ds-btn ds-btn-primary ds-btn-default">
            {primary.label}
          </Link>
          {secondary ? (
            <Link href={secondary.href} className="ds-btn ds-btn-secondary ds-btn-default">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
      <DrLino className="docs-hero-lino" />
    </div>
  );
}

// O fluxo em blocos com relevo, número em pílula e setas.
export function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="not-prose docs-flow">
      {steps.map((step, i) => (
        <Fragment key={step}>
          {i > 0 ? <ArrowRight className="docs-flow-arrow" aria-hidden="true" /> : null}
          <span className="docs-flow-step">
            <i>{i + 1}</i>
            {step}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

// Cartão branco com relevo de 5 px e o ícone num quadrado azul-claro. Com `href`, o cartão é o link.
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
      {icon ? <span className="docs-card-tile">{icon}</span> : null}
      <span className="docs-card-title">{title}</span>
      {children ? <span className="docs-card-text">{children}</span> : null}
    </>
  );
  if (!href) return <div className="not-prose docs-card">{body}</div>;
  return (
    <Link href={href} className="not-prose docs-card docs-card-link">
      {body}
    </Link>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid gap-4 sm:grid-cols-2">{children}</div>;
}

const CALLOUT = {
  info: { background: COLOR.primary50, color: COLOR.primary900, icon: Info, tint: COLOR.action },
  warn: { background: COLOR.warningBg, color: COLOR.warningInk, icon: TriangleExclamationPoint, tint: COLOR.yellow },
  error: { background: COLOR.dangerBg, color: COLOR.dangerInk, icon: OctagonX, tint: COLOR.dangerInk },
  success: { background: COLOR.successBg, color: COLOR.successInk, icon: CircleCheck, tint: COLOR.green },
} as const;

// Aviso nas cores de estado do DS, com o ícone num quadrado branco.
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
  const Icon = tone.icon;
  return (
    <div className="docs-callout" style={{ background: tone.background, color: tone.color }}>
      <span className="docs-callout-icon" style={{ color: tone.tint }}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        {title ? <span className="mb-0.5 block font-extrabold">{title}</span> : null}
        <div className="prose-no-margin [&_a]:text-inherit [&_a]:underline [&_code]:bg-white/60">{children}</div>
      </div>
    </div>
  );
}
