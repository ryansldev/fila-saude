import { Character } from "@/components/character";
import { KnowMoreButton } from "./knoe-more-button";

export function HeroSection() {
  return (
    <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-6 py-8 sm:gap-8 sm:py-10 md:gap-10 md:py-14 lg:max-w-6xl lg:flex-row lg:items-center lg:gap-28 lg:py-24">
      <Character size="md" className="w-56 shrink-0 sm:w-64 md:w-80 lg:w-[22.5rem]" />

      <div className="flex w-full min-w-0 max-w-xl flex-col items-center gap-5 text-center sm:gap-6 md:max-w-2xl md:gap-8 lg:flex-1 lg:max-w-none lg:items-start lg:gap-10 lg:text-left">
        <div className="mx-auto flex w-full min-w-0 max-w-lg flex-col gap-3 sm:gap-4 md:max-w-xl md:gap-5 lg:mx-0 lg:max-w-none">
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-900 lowercase sm:text-5xl md:text-5xl lg:text-[4.0625rem]">
            chega de esperar <span className="text-primary">horas no postinho.</span>
          </h1>
          <p className="mx-auto max-w-lg text-lg leading-8 text-gray-600 sm:text-xl sm:leading-9 md:max-w-xl md:text-xl md:leading-9 lg:mx-0 lg:max-w-xl lg:text-2xl lg:leading-10">
            Entra na fila pelo celular, acompanha a posição ao vivo e só vai na hora. Grátis e open source.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
          <KnowMoreButton />
        </div>
      </div>
    </section>
  );
}
