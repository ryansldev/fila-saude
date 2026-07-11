import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FeatureSectionProps {
  step: number;
  headline: string;
  body: string;
  visual: ReactNode;
  reverse?: boolean;
}

export function FeatureSection({ step, headline, body, visual, reverse = false }: FeatureSectionProps) {
  return (
    <article
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-10 py-14 md:flex-row md:items-center md:gap-12 md:py-16 lg:gap-[4.4rem] lg:py-[5.5rem]",
        reverse && "md:flex-row-reverse",
      )}
    >
      <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-4 text-center md:items-start md:text-left">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary-100 text-base font-extrabold text-primary-700">
          {step}
        </span>
        <h2 className="text-balance text-[2.0625rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 lowercase sm:text-[2.475rem] lg:text-[2.75rem]">
          {headline}
        </h2>
        <p className="max-w-md text-[1.2375rem] leading-[2.2rem] text-gray-600 sm:text-[1.375rem] sm:leading-[2.475rem] lg:max-w-[30.8rem]">
          {body}
        </p>
      </div>

      <div className="flex w-full min-w-0 max-w-full items-center justify-center md:w-auto md:max-w-[24.2rem] md:flex-[1.15] lg:max-w-[26.4rem]">
        {visual}
      </div>
    </article>
  );
}
