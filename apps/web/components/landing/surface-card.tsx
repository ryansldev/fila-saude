import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div className={cn("rounded-2xl border border-b-4 border-gray-100 bg-gray-50 shadow-sm", className)}>{children}</div>
  );
}
