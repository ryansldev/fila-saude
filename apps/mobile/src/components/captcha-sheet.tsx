import { useCallback, useEffect, useState } from "react";
import { Button, Sheet, SoftText, Title } from "@/components/ui";
import CaptchaWidget from "./captcha";

/**
 * AD-062: gaveta do captcha (Cloudflare Turnstile), quase sempre resolvida sem a pessoa fazer nada. Se não
 * der para confirmar no aparelho, avisa e orienta a procurar a recepção.
 */
export function CaptchaSheet({
  open,
  close,
  onToken,
}: {
  open: boolean;
  close: () => void;
  onToken: (token: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  // Trocar a chave monta o widget de novo (o "tentar de novo").
  const [attempt, setAttempt] = useState(0);
  const onError = useCallback(() => setFailed(true), []);
  // Cada vez que a gaveta abre, o widget começa de novo (uma falha antiga não fica na tela).
  useEffect(() => {
    if (open) setFailed(false);
  }, [open]);
  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  return (
    <Sheet open={open} close={close}>
      <Title>só um instante</Title>
      {failed ? (
        <>
          <SoftText>não deu para confirmar que é você. tente de novo ou procure a recepção da unidade.</SoftText>
          <Button text="tentar de novo" onPress={retry} />
        </>
      ) : (
        <>
          <SoftText>estamos confirmando que você não é um robô.</SoftText>
          {open ? <CaptchaWidget key={attempt} onToken={onToken} onError={onError} /> : null}
        </>
      )}
      <Button variant="text" text="voltar" onPress={close} />
    </Sheet>
  );
}
