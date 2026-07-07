import { REPOSITORY_URL } from "@/lib/constants";

import { BrandName } from "./brand-name";
import { GithubCtaButton } from "./github-cta-button";

interface CtaBannerProps {
  repositoryUrl?: string;
}

export function CtaBanner({ repositoryUrl = REPOSITORY_URL }: CtaBannerProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-2 py-12 text-center sm:px-0 sm:py-20 lg:py-24">
      <h2 className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-3xl font-extrabold leading-[1.1] lowercase tracking-tight text-gray-900 sm:text-4xl lg:text-[2.5rem]">
        <span>ajude a construir o</span>
        <BrandName size="lg" />
      </h2>
      <p className="max-w-md px-2 text-lg leading-8 text-gray-600 sm:px-0 sm:text-xl sm:leading-9">
        Open source, feito por quem usa o SUS. Contribui e ajuda quem espera no postinho.
      </p>
      <GithubCtaButton repositoryUrl={repositoryUrl} icon className="tracking-wide">
        Ver no GitHub
      </GithubCtaButton>
    </section>
  );
}
