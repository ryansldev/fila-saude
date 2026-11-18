import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BrandName } from "@/components/landing/brand-name";
import { REPOSITORY_URL } from "@/lib/constants";

// Cabeçalho das docs: a marca da landing, "docs" ao lado, e o link do código.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <BrandName size="sm" logoClassName="size-6 text-fd-primary" textClassName="text-base" />
          <span className="text-fd-muted-foreground font-semibold">docs</span>
        </span>
      ),
      url: "/docs",
    },
    githubUrl: REPOSITORY_URL,
    themeSwitch: { enabled: false },
  };
}
