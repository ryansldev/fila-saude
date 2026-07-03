import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Character } from "@/components/character";
import { Button } from "@/components/ui/button";
import { REPOSITORY_URL } from "@/lib/constants";

interface HeroSectionProps {
  repositoryUrl?: string;
}

export function HeroSection({ repositoryUrl = REPOSITORY_URL }: HeroSectionProps) {
  return (
    <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-8 py-8 md:flex-row md:items-center md:gap-12 md:py-16 lg:gap-16 lg:py-20">
      <Character
        size="md"
        className="w-full max-w-[13.5rem] shrink-0 sm:max-w-[15rem] md:w-[min(36vw,18rem)] md:max-w-none lg:w-[21.25rem]"
      />

      <div className="flex w-full min-w-0 flex-col items-center gap-6 md:flex-1 md:items-start md:gap-8">
        <div className="flex flex-col gap-3 text-center md:gap-4 md:text-left">
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-900 lowercase sm:text-5xl lg:text-[3.25rem] xl:text-[3.5rem]">
            chega de esperar <span className="text-primary">horas no postinho.</span>
          </h1>

          <p className="mx-auto max-w-lg text-lg leading-8 text-gray-600 md:mx-0 sm:text-xl sm:leading-9">
            Entra na fila pelo celular, acompanha a posição ao vivo e só vai na hora. Grátis e open source.
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-3 md:items-start lg:flex-row lg:flex-wrap">
          <Button
            className="w-full min-w-0 tracking-wide md:w-auto md:min-w-28"
            render={<Link href="#como-funciona" />}
          >
            Como funciona
          </Button>
          <Button
            variant="secondary"
            className="w-full min-w-0 gap-2 tracking-wide md:w-auto md:min-w-28"
            render={<Link href={repositoryUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <span className="md:hidden">GitHub</span>
            <span className="hidden md:inline">Contribuir no GitHub</span>
            <ArrowUpRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
