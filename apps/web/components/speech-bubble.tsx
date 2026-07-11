import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/landing/surface-card";
import { cn } from "@/lib/utils";

interface SpeechBubbleProps {
  children: ReactNode;
  className?: string;
}

export function SpeechBubble({ children, className }: SpeechBubbleProps) {
  return (
    <SurfaceCard
      className={cn("relative px-[1.1rem] py-[0.9625rem] text-left sm:px-[1.65rem] sm:py-[1.375rem]", className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full sm:hidden"
      >
        <span className="block size-0 border-x-[10px] border-x-transparent border-b-[14px] border-b-gray-200" />
        <span className="absolute top-px left-1/2 -translate-x-1/2 size-0 border-x-[9px] border-x-transparent border-b-[13px] border-b-gray-50" />
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute top-[38%] left-0 hidden -translate-x-full -translate-y-1/2 sm:block"
      >
        <span className="block size-0 border-y-[10px] border-y-transparent border-r-[14px] border-r-gray-200" />
        <span className="absolute top-1/2 left-px -translate-y-1/2 size-0 border-y-[9px] border-y-transparent border-r-[13px] border-r-gray-50" />
      </span>

      {children}
    </SurfaceCard>
  );
}
