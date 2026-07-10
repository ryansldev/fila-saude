import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageFooterProps {
  children: ReactNode;
  className?: string;
}

export function PageFooter({ children, className }: PageFooterProps) {
  return (
    <footer
      className={cn(
        "mx-auto mt-4 w-full max-w-5xl border-t border-gray-100 px-4 pb-6 pt-6 text-center text-base leading-relaxed text-gray-500 sm:px-6 sm:pb-8 sm:text-[1.1rem] lg:px-8",
        className,
      )}
    >
      {children}
    </footer>
  );
}
