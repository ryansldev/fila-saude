import { FeatureSection } from "@/components/landing/feature-section";
import { QuestionnaireIllustration } from "@/components/landing/illustrations/questionnaire-illustration";
import { QueuePositionIllustration } from "@/components/landing/illustrations/queue-position-illustration";
import { SlotAllocationIllustration } from "@/components/landing/illustrations/slot-allocation-illustration";
import { headerHeight } from "@/components/landing/page-shell";

const features = [
  {
    headline: "diga o que sente, de casa",
    body: "São cinco telas de toque, sem texto livre. Sinal de alarme não entra em fila: o app manda ligar 192. O resto vira um nível sugerido, que a equipe confirma.",
    reverse: false,
    visual: <QuestionnaireIllustration />,
  },
  {
    headline: "pegue a vaga ou mostre interesse",
    body: "Clínico geral é público: você escolhe o dia e a vaga é sua, sem esperar aprovação. Em atendimento privado, como odontologia, você mostra interesse e a equipe escolhe quem vai, explicando o motivo.",
    reverse: true,
    visual: <SlotAllocationIllustration />,
  },
  {
    headline: "espere em casa, chegue na hora",
    body: "No dia, o app mostra sua posição e o tempo. Quando a vez se aproxima, chega o aviso “saia de casa”. Na unidade, você lê o QR da TV pra confirmar a chegada, e a TV chama pela senha.",
    reverse: false,
    visual: <QueuePositionIllustration />,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-label="Como funciona"
      className="flex w-full min-w-0 flex-col"
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
