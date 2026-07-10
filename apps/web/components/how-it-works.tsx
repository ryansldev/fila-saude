import { FeatureSection } from "@/components/landing/feature-section";
import { NearbyClinicsIllustration } from "@/components/landing/illustrations/nearby-clinics-illustration";
import { NotificationIllustration } from "@/components/landing/illustrations/notification-illustration";
import { QueuePositionIllustration } from "@/components/landing/illustrations/queue-position-illustration";
import { QueueTransparencyIllustration } from "@/components/landing/illustrations/queue-transparency-illustration";
import { SymptomInputIllustration } from "@/components/landing/illustrations/symptom-input-illustration";
import { UrgencyCheckIllustration } from "@/components/landing/illustrations/urgency-check-illustration";

const features = [
  {
    headline: "dizer do que precisa",
    body: "Pra quem é, consulta ou exame, e o motivo. Exame pede foto da requisição e segue só pra UBS.",
    reverse: false,
    visual: <SymptomInputIllustration />,
  },
  {
    headline: "fazer a pré-triagem",
    body: "Marca sinais urgentes, se tiver. Tem algum? Vai pra UPA. Não tem? Caminho leve na UBS. Na unidade, o enfermeiro faz a classificação oficial.",
    reverse: true,
    visual: <UrgencyCheckIllustration />,
  },
  {
    headline: "ir pro lugar certo",
    body: "A pré-triagem indica UBS ou UPA. Na UBS, só entra onde você tá cadastrado. Na UPA, sem cadastro. Quer trocar de UBS? Cadastra em outra e sai da anterior.",
    reverse: false,
    visual: <NearbyClinicsIllustration />,
  },
  {
    headline: "acompanhar a posição",
    body: "Consulta entra na fila de acolhimento. Vê ao vivo quantas pessoas faltam.",
    reverse: true,
    visual: <QueuePositionIllustration />,
  },
  {
    headline: "entender a fila",
    body: "Toque nas 3 pessoas na frente. Vê quem tá antes e por que. Nada de adivinhar.",
    reverse: false,
    visual: <QueueTransparencyIllustration />,
  },
  {
    headline: "ir na hora certa",
    body: "Chegou sua vez no acolhimento? A gente te avisa. Você só vai na hora.",
    reverse: true,
    visual: <NotificationIllustration />,
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-label="Como funciona" className="flex w-full min-w-0 flex-col">
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
