import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BrandName } from "@/components/landing/brand-name";
import { CURRENT_API_VERSION } from "@/lib/api-versions";
import { REPOSITORY_URL } from "@/lib/constants";

// Cabeçalho das docs: a marca da landing, com "docs" ao lado.
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
  };
}

// O resto do layout das docs: o código, o OpenAPI da versão atual para baixar e sem troca de tema (só o
// claro).
export function docsOptions(): Omit<BaseLayoutProps, "nav"> {
  return {
    githubUrl: REPOSITORY_URL,
    themeSwitch: { enabled: false },
    links: [{ text: "OpenAPI", url: `/openapi/${CURRENT_API_VERSION}.json`, external: true }],
  };
}
