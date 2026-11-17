import { Button } from "@/components/ui/button";
import type { Answer } from "./kinds";

/** RN-CONF-02: o que a pessoa respondeu na ligação; o mesmo trio na sessão e na lista de ligação. */
export function AnswerButtons({ sending, onAnswer }: { sending: boolean; onAnswer: (answer: Answer) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="compact" variant="success" disabled={sending} onClick={() => onAnswer("confirmed")}>
        Confirmou
      </Button>
      <Button size="compact" variant="secondary" disabled={sending} onClick={() => onAnswer("no_contact")}>
        Sem contato
      </Button>
      <Button size="compact" variant="outlineDanger" disabled={sending} onClick={() => onAnswer("refused")}>
        Recusou
      </Button>
    </div>
  );
}
