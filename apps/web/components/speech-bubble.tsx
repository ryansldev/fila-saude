import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SpeechBubbleProps {
  children: ReactNode;
  className?: string;
}

export function SpeechBubble({ children, className }: SpeechBubbleProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-b-4 border-gray-100 bg-gray-50 px-4 py-3.5 text-left shadow-sm sm:px-6 sm:py-5",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full sm:hidden"
      >
        <span className="block size-0 border-x-[9px] border-x-transparent border-b-13 border-b-gray-200" />
        <span className="absolute top-px left-1/2 -translate-x-1/2 size-0 border-x-8 border-x-transparent border-b-12 border-b-gray-50" />
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute top-[38%] left-0 hidden -translate-x-full -translate-y-1/2 sm:block"
      >
        <span className="block size-0 border-y-[9px] border-y-transparent border-r-13 border-r-gray-200" />
        <span className="absolute top-1/2 left-px -translate-y-1/2 size-0 border-y-8 border-y-transparent border-r-12 border-r-gray-50" />
      </span>

      {children}
    </div>
  );
}
