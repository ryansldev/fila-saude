import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Loading } from "@/components/ui";
import { explainNoticesFirst } from "@/lib/notices";
import { destinationWithoutAccount, KEY_ONBOARDING } from "@/lib/onboarding";
import { useSession } from "@/lib/session";
import { read } from "@/lib/storage";

/**
 * Sem conta → boas-vindas (ou entrar, se já viu o "conhecer o app"); avisos que ainda dá para pedir → explicar (uma vez);
 * sem município → escolher; senão, minha fila.
 */
const ANDROID_API = Platform.OS === "android" ? Number(Platform.Version) : null;

export default function Start() {
  const s = useSession();
  const withoutAccount = s.ready && s.notices !== null && !s.token;
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (withoutAccount) void read(KEY_ONBOARDING).then((v) => setSeen(v ?? null));
  }, [withoutAccount]);

  useEffect(() => {
    if (!withoutAccount || seen === undefined) return;
    const [first, ...rest] = destinationWithoutAccount(seen);
    if (first) router.replace(first);
    for (const route of rest) router.push(route);
  }, [withoutAccount, seen]);

  if (!s.ready || s.notices === null || withoutAccount) return <Loading full />;
  if (explainNoticesFirst(s.notices, s.explainedNotices, ANDROID_API)) return <Redirect href="/avisos" />;
  if (!s.municipality) return <Redirect href="/municipio" />;
  return <Redirect href="/inicio" />;
}
