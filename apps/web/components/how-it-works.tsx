import { FeatureSection } from "@/components/landing/feature-section";
import { NearbyClinicsIllustration } from "@/components/landing/illustrations/nearby-clinics-illustration";
import { NotificationIllustration } from "@/components/landing/illustrations/notification-illustration";
import { QueuePositionIllustration } from "@/components/landing/illustrations/queue-position-illustration";
import { QueueTransparencyIllustration } from "@/components/landing/illustrations/queue-transparency-illustration";
import { SymptomInputIllustration } from "@/components/landing/illustrations/symptom-input-illustration";
import { headerHeight } from "@/components/landing/page-shell";

const features = [
  {
    headline: "dizer do que precisa",
    body: "Escolhe consulta, exame ou vacina. Conta o motivo. Só consulta abre acolhimento remoto. Exame e vacina avisam o assistente.",
    reverse: false,
    visual: <SymptomInputIllustration />,
  },
  {
    headline: "ver o que tem hoje",
    body: "Vê as UBS perto de você. Só entra na fila onde você tá cadastrado. Quer trocar? Cadastra em outra e sai da anterior. Na UPA não precisa disso.",
    reverse: true,
    visual: <NearbyClinicsIllustration />,
  },
  {
    headline: "acompanhar a posição",
    body: "Consulta entra na fila de acolhimento. Vê ao vivo quantas pessoas faltam.",
    reverse: false,
    visual: <QueuePositionIllustration />,
  },
  {
    headline: "entender a fila",
    body: "Toque nas 3 pessoas na frente. Vê quem tá antes e por que. Nada de adivinhar.",
    reverse: true,
    visual: <QueueTransparencyIllustration />,
  },
  {
    headline: "ir na hora certa",
    body: "Chegou sua vez no acolhimento? A gente te avisa. Você só vai na hora.",
    reverse: false,
    visual: <NotificationIllustration />,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-label="Como funciona"
      className="flex w-full min-w-0 flex-col pt-14 sm:pt-20 md:pt-24"
      style={{ scrollMarginTop: `calc(${headerHeight} + 1rem)` }}
    >
      {features.map((feature, index) => (
        <FeatureSection
          key={feature.headline}
          headline={feature.headline}
          body={feature.body}
          visual={feature.visual}
          reverse={feature.reverse}
          step={index + 1}
        />
      ))}
    </section>
  );
}
