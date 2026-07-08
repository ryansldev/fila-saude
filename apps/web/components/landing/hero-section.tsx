import Link from "next/link";

import { Character } from "@/components/character";
import { Button } from "@/components/ui/button";

import { GithubCtaButton } from "./github-cta-button";

export function HeroSection() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 py-8 sm:gap-8 sm:py-10 md:flex-row md:items-center md:gap-16 md:py-14 lg:gap-24 lg:py-20">
      <Character size="md" className="w-40 shrink-0 sm:w-48 md:w-56 lg:w-72" />

      <div className="flex w-full max-w-xl flex-col items-center gap-5 text-center sm:gap-6 md:flex-1 md:max-w-none md:items-start md:gap-8 md:text-left">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 md:mx-0 md:max-w-none md:gap-4">
          <h1 className="text-balance text-3xl font-extrabold leading-[1.08] tracking-tight text-gray-900 lowercase sm:text-4xl md:text-5xl lg:text-[3.25rem]">
            chega de esperar <span className="text-primary">horas no postinho.</span>
          </h1>
          <p className="max-w-lg text-base leading-7 text-gray-600 sm:text-lg sm:leading-8 md:text-xl md:leading-9">
            Entra na fila pelo celular, acompanha a posição ao vivo e só vai na hora. Grátis e open source.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center md:justify-start">
          <Button className="w-full sm:w-auto sm:min-w-44" render={<Link href="#como-funciona" />}>
            Como funciona
          </Button>
          <GithubCtaButton variant="secondary" icon className="w-full sm:w-auto sm:min-w-44">
            Contribuir no GitHub
          </GithubCtaButton>
        </div>
      </div>
    </section>
  );
}
