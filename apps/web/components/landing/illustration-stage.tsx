import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface IllustrationStageProps {
  children: ReactNode;
  className?: string;
  tone?: "primary" | "green" | "yellow";
}

const toneClasses = {
  primary: "bg-primary-100",
  green: "bg-green-100",
  yellow: "bg-yellow-100",
} as const;

export function IllustrationStage({ children, className, tone = "primary" }: IllustrationStageProps) {
  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 max-w-full items-center justify-center overflow-x-clip py-[1.65rem] sm:py-9 lg:py-[3.3rem]",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute size-[min(100%,15.4rem)] rounded-full opacity-90 sm:size-[19.8rem] lg:size-[24.2rem]",
          toneClasses[tone],
        )}
      />
      <div className="relative w-full min-w-0 max-w-full">{children}</div>
    </div>
  );
}

interface IllustrationSceneProps {
  children: ReactNode;
  className?: string;
}

/** Wrapper for phone + floating elements. Width follows the phone frame. */
export function IllustrationScene({ children, className }: IllustrationSceneProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-full px-1 pt-[2.475rem] pb-[1.1rem] sm:max-w-[22rem] sm:px-2 sm:pt-9 sm:pb-[1.65rem] lg:max-w-[24.2rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-full rounded-[1.75rem] border-[4px] border-gray-200 bg-white p-3 shadow-[0_16px_40px_-14px_rgba(97,124,196,0.35)] sm:rounded-[2.25rem] sm:border-[5px] sm:p-4 lg:rounded-[2.5rem] lg:p-4.5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-center gap-2 sm:mb-4">
        <span className="size-2 rounded-full bg-gray-200" />
        <span className="h-2 w-12 rounded-full bg-gray-100" />
      </div>
      <div className="min-w-0 text-[0.9625rem] leading-snug">{children}</div>
    </div>
  );
}

export function floatingBadgeClasses(align: "left" | "right" = "right") {
  return cn(
    "absolute top-0 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-2 rounded-full border border-b-[3px] border-gray-100 bg-white px-3 py-1.5 shadow-md sm:px-4 sm:py-2",
    align === "left" ? "left-0" : "right-0",
  );
}

interface FloatingBadgeProps {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function FloatingBadge({ children, align = "right", className }: FloatingBadgeProps) {
  return <div className={cn(floatingBadgeClasses(align), className)}>{children}</div>;
}

export const primaryCtaBarClasses =
  "rounded-2xl border border-b-4 border-primary-700 bg-primary py-[0.9625rem] text-center text-[1.1rem] font-extrabold uppercase tracking-wide text-white shadow-sm";

interface PrimaryCtaBarProps {
  children: ReactNode;
  className?: string;
}

export function PrimaryCtaBar({ children, className }: PrimaryCtaBarProps) {
  return <div className={cn(primaryCtaBarClasses, className)}>{children}</div>;
}

interface PhoneQueueHeaderProps {
  ticket: string;
  unitName?: string;
  serviceName?: string;
  className?: string;
}

export function PhoneQueueHeader({
  ticket,
  unitName = "UBS Centro",
  serviceName = "acolhimento",
  className,
}: PhoneQueueHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-[2.475rem] shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
        <MapPin className="size-[1.1rem]" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.1rem] font-bold text-gray-800">{unitName}</p>
        <p className="truncate text-[0.9625rem] font-bold text-primary">{serviceName}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[0.9625rem] font-bold text-gray-500">senha</p>
        <p className="font-mono text-[1.1rem] font-extrabold tabular-nums text-primary">{ticket}</p>
      </div>
    </div>
  );
}
