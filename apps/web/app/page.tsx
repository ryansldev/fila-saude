import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Character } from "@/components/character";
import { HowItWorks } from "@/components/how-it-works";
import { SpeechBubble } from "@/components/speech-bubble";
import { Button } from "@/components/ui/button";

const repositoryUrl = "https://github.com/ryansldev/fila-saude";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-14 sm:gap-20">
        <section className="w-full max-w-sm sm:max-w-2xl">
          <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-start">
            <Character size="md" className="mr-8 w-[clamp(200px,28vw,260px)] shrink-0 sm:mr-0" />

            <div className="flex w-full flex-col gap-4 sm:flex-1 sm:gap-5 sm:pt-[clamp(2.75rem,11vw,5.25rem)]">
              <SpeechBubble className="w-full">
                <p className="text-sm leading-relaxed text-gray-800 sm:text-base">
                  <strong>Chega de esperar horas no posto.</strong> Entre na fila pelo celular e só vá quando for a sua
                  vez. É gratuito e open source.
                </p>
              </SpeechBubble>

              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <Button
                  // variant="secondary"
                  className="w-full sm:w-auto gap-2"
                  render={<Link href={repositoryUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  Contribua com o projeto
                  <ArrowUpRight />
                </Button>
                {/* <Button variant="default" className="w-full sm:w-auto" render={<Link href="#como-funciona" />}>
                  Veja como funciona
                </Button> */}
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />
      </div>

      <footer className="mt-10 text-center text-sm text-gray-500">
        Feito com 💙 por <strong className="font-semibold text-gray-700">brasileiros que usam o SUS</strong>
      </footer>
    </main>
  );
}
