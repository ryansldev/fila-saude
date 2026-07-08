import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const headerHeight = "4.25rem";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={cn("flex min-h-screen flex-col overflow-x-clip bg-background px-4 sm:px-6 lg:px-8", className)}
      style={{ paddingTop: `calc(${headerHeight} + 1.5rem)` }}
    >
      {children}
    </main>
  );
}
