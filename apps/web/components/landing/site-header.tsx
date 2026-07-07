import Link from "next/link";
import type { ReactNode } from "react";

import { REPOSITORY_URL } from "@/lib/constants";

import { BrandName } from "./brand-name";
import { GithubCtaButton } from "./github-cta-button";
import { headerHeight } from "./page-shell";

interface SiteHeaderProps {
  cta?: ReactNode;
  repositoryUrl?: string;
}

export function SiteHeader({ cta, repositoryUrl = REPOSITORY_URL }: SiteHeaderProps) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-background/95 backdrop-blur-sm"
      style={{ height: headerHeight }}
    >
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <BrandName logoClassName="size-8 sm:size-9" textClassName="text-lg font-extrabold sm:text-xl" />
        </Link>

        {cta ?? (
          <GithubCtaButton
            repositoryUrl={repositoryUrl}
            className="h-9 shrink-0 px-3 text-sm uppercase tracking-wide sm:h-11 sm:min-w-28 sm:px-8 sm:text-base"
          >
            Contribuir
          </GithubCtaButton>
        )}
      </div>
    </header>
  );
}
