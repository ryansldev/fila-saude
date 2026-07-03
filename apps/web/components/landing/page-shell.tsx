import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const headerHeight = "4.25rem";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={cn(
        "flex min-h-screen flex-col overflow-x-clip bg-background px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8",
        className,
      )}
      style={{ paddingTop: `calc(${headerHeight} + 1.5rem)` }}
    >
      {children}
    </main>
  );
}

export { headerHeight };
