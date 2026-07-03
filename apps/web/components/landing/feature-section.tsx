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
        "mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-10 py-12 md:flex-row md:items-center md:gap-12 md:py-16 lg:gap-16 lg:py-20",
        reverse && "md:flex-row-reverse",
      )}
    >
      <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-4 text-center md:items-start md:text-left">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-100 text-sm font-extrabold text-primary-700">
          {step}
        </span>
        <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-gray-900 lowercase sm:text-4xl lg:text-[2.5rem]">
          {headline}
        </h2>
        <p className="max-w-md text-lg leading-8 text-gray-600 sm:text-xl sm:leading-9">{body}</p>
      </div>

      <div className="flex w-full min-w-0 max-w-full items-center justify-center md:w-auto md:max-w-[22rem] md:flex-[1.15] lg:max-w-[24rem]">
        {visual}
      </div>
    </article>
  );
}
