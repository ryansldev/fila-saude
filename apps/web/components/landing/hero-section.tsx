import Link from "next/link";

import { Character } from "@/components/character";
import { Button } from "@/components/ui/button";

import { GithubCtaButton } from "./github-cta-button";

export function HeroSection() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 py-8 md:flex-row md:gap-12 md:py-16 lg:gap-16 lg:py-20">
      <Character size="md" className="w-48 shrink-0 sm:w-56 md:w-72" />

      <div className="flex flex-col items-center gap-6 text-center md:flex-1 md:items-start md:gap-8 md:text-left">
        <div className="flex flex-col gap-3 md:gap-4">
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-900 lowercase sm:text-5xl lg:text-[3.25rem]">
            chega de esperar <span className="text-primary">horas no postinho.</span>
          </h1>
          <p className="max-w-lg text-lg leading-8 text-gray-600 sm:text-xl sm:leading-9">
            Entra na fila pelo celular, acompanha a posição ao vivo e só vai na hora. Grátis e open source.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button className="w-full sm:w-auto" render={<Link href="#como-funciona" />}>
            Como funciona
          </Button>
          <GithubCtaButton variant="secondary" icon className="w-full sm:w-auto">
            Contribuir no GitHub
          </GithubCtaButton>
        </div>
      </div>
    </section>
  );
}
