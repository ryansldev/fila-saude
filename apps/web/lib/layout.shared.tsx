import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Download } from "lucide-react";
import { BrandName } from "@/components/landing/brand-name";
import { CURRENT_API_VERSION } from "@/lib/api-versions";
import { REPOSITORY_URL } from "@/lib/constants";

// Topo das docs (`.specs/features/design-system/docs.md`): a marca com a versão atual em pílula clara.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <BrandName size="sm" logoClassName="size-6 text-fd-primary" textClassName="text-base" />
          <span className="docs-version">{CURRENT_API_VERSION}</span>
        </span>
      ),
      url: "/docs",
    },
  };
}

// À direita do topo: o `llms.txt`, o GitHub (botão-ícone do kit) e "baixar o OpenAPI" (principal do kit).
export function docsOptions(): Omit<BaseLayoutProps, "nav"> {
  return {
    themeSwitch: { enabled: false },
    // No celular o topo esconde estes itens: o menu lateral traz os mesmos links (`on: "menu"`).
    links: [
      { type: "main", text: "llms.txt", url: "/llms.txt", on: "nav" },
      { type: "main", text: "baixar o OpenAPI", url: `/openapi/${CURRENT_API_VERSION}.json`, on: "menu" },
      { type: "main", text: "GitHub", url: REPOSITORY_URL, external: true, on: "menu" },
      { type: "main", text: "llms.txt", url: "/llms.txt", on: "menu" },
      {
        type: "custom",
        on: "nav",
        children: (
          <a href={REPOSITORY_URL} className="ds-btn ds-btn-secondary ds-btn-icon text-fd-foreground">
            <span className="sr-only">GitHub</span>
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
          </a>
        ),
      },
      {
        type: "custom",
        on: "nav",
        children: (
          <a href={`/openapi/${CURRENT_API_VERSION}.json`} className="ds-btn ds-btn-primary ds-btn-compact">
            <Download className="size-4" />
            baixar o OpenAPI
          </a>
        ),
      },
    ],
  };
}
