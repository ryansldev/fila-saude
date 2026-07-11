import { REPOSITORY_URL } from "@/lib/constants";

import { BrandName } from "./brand-name";
import { GithubCtaButton } from "./github-cta-button";

interface CtaBannerProps {
  repositoryUrl?: string;
}

export function CtaBanner({ repositoryUrl = REPOSITORY_URL }: CtaBannerProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 px-2 py-14 text-center sm:px-0 sm:py-20 lg:py-[6.6rem]">
      <h2 className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[2.0625rem] font-extrabold leading-[1.1] lowercase tracking-tight text-gray-900 sm:text-[2.475rem] lg:text-[2.75rem]">
        <span>ajude a construir o</span>
        <BrandName size="lg" />
      </h2>
      <p className="max-w-md px-2 text-[1.2375rem] leading-[2.2rem] text-gray-600 sm:px-0 sm:text-[1.375rem] sm:leading-[2.475rem] lg:max-w-[30.8rem]">
        Open source, feito por quem usa o SUS. Contribui e ajuda quem espera no postinho.
      </p>
      <GithubCtaButton repositoryUrl={repositoryUrl} icon className="tracking-wide">
        Ver no GitHub
      </GithubCtaButton>
    </section>
  );
}
