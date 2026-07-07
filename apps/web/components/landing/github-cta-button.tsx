import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { REPOSITORY_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface GithubCtaButtonProps {
  repositoryUrl?: string;
  variant?: "default" | "secondary";
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}

export function GithubCtaButton({
  repositoryUrl = REPOSITORY_URL,
  variant = "default",
  children,
  className,
  icon = false,
}: GithubCtaButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn(icon && "gap-2", className)}
      render={<Link href={repositoryUrl} target="_blank" rel="noopener noreferrer" />}
    >
      {children}
      {icon ? <ArrowUpRight aria-hidden /> : null}
      <span className="sr-only"> (abre em nova aba)</span>
    </Button>
  );
}
